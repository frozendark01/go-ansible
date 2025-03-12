package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// PlaybookInfo stores information about a playbook
type PlaybookInfo struct {
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	LastRunTime time.Time `json:"lastRunTime"`
	Status      string    `json:"status"`
}

// PlaybookResult stores execution results
type PlaybookResult struct {
	PlaybookName string `json:"playbookName"`
	Output       string `json:"output"`
	Success      bool   `json:"success"`
	RunTime      string `json:"runTime"`
}

var (
	playbooksDir  = "/etc/ansible/playbooks" // Default directory, change as needed
	playbooks     = []PlaybookInfo{}
	playbackCache = map[string]PlaybookResult{}
)

func main() {
	// Setup routes
	http.HandleFunc("/", handleHome)
	http.HandleFunc("/api/playbooks", handlePlaybooks)
	http.HandleFunc("/api/run", handleRunPlaybook)
	http.HandleFunc("/api/result/", handleResults)
	
	// Serve static files
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))
	
	// Initial playbook scan
	scanPlaybooks()
	
	// Start server
	log.Println("Starting server on :8080...")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func scanPlaybooks() {
	playbooks = []PlaybookInfo{} // Reset list
	
	files, err := ioutil.ReadDir(playbooksDir)
	if err != nil {
		log.Printf("Error reading playbooks directory: %v", err)
		return
	}
	
	for _, file := range files {
		if !file.IsDir() && (strings.HasSuffix(file.Name(), ".yml") || strings.HasSuffix(file.Name(), ".yaml")) {
			playbooks = append(playbooks, PlaybookInfo{
				Name:   file.Name(),
				Path:   filepath.Join(playbooksDir, file.Name()),
				Status: "Ready",
			})
		}
	}
}

func handleHome(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	
	tmpl, err := template.ParseFiles("templates/index.html")
	if err != nil {
		http.Error(w, "Failed to load template", http.StatusInternalServerError)
		return
	}
	
	tmpl.Execute(w, nil)
}

func handlePlaybooks(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		scanPlaybooks() // Rescan for updates
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(playbooks)
		return
	}
	
	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func handleRunPlaybook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var requestData struct {
		PlaybookName string `json:"playbookName"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	
	// Validate playbook name to prevent command injection
	var playbookPath string
	found := false
	
	for _, playbook := range playbooks {
		if playbook.Name == requestData.PlaybookName {
			playbookPath = playbook.Path
			found = true
			break
		}
	}
	
	if !found {
		http.Error(w, "Playbook not found", http.StatusNotFound)
		return
	}
	
	// Execute playbook asynchronously
	go executePlaybook(requestData.PlaybookName, playbookPath)
	
	// Update status
	for i := range playbooks {
		if playbooks[i].Name == requestData.PlaybookName {
			playbooks[i].Status = "Running"
			playbooks[i].LastRunTime = time.Now()
			break
		}
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "Started"})
}

func handleResults(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	playbookName := strings.TrimPrefix(r.URL.Path, "/api/result/")
	if playbookName == "" {
		http.Error(w, "Playbook name required", http.StatusBadRequest)
		return
	}
	
	result, exists := playbackCache[playbookName]
	if !exists {
		result = PlaybookResult{
			PlaybookName: playbookName,
			Output:       "No execution results available",
			Success:      false,
		}
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func executePlaybook(name, path string) {
	start := time.Now()
	
	cmd := exec.Command("ansible-playbook", path)
	output, err := cmd.CombinedOutput()
	
	duration := time.Since(start)
	success := err == nil
	
	// Store result
	playbackCache[name] = PlaybookResult{
		PlaybookName: name,
		Output:       string(output),
		Success:      success,
		RunTime:      duration.String(),
	}
	
	// Update status
	for i := range playbooks {
		if playbooks[i].Name == name {
			if success {
				playbooks[i].Status = "Success"
			} else {
				playbooks[i].Status = "Failed"
			}
			break
		}
	}
}
