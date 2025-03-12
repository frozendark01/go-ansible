# go-ansible
 Go-based web dashboard for managing your Ansible playbooks 
 
By default, the dashboard looks for playbooks in /etc/ansible/playbooks. 
If your playbooks are stored elsewhere, modify the playbooksDir variable in main.go:
```
var (
    playbooksDir = "/path/to/your/playbooks" // Change this to your actual path
    playbooks     = []PlaybookInfo{}
    playbackCache = map[string]PlaybookResult{}
)
```
# Navigate to project directory
```
cd /opt/ansible-dashboard
```
# Build the Go application
```
go build -o ansible-dashboard main.go
```
# Run the application
```
./ansible-dashboard
```
# Set Up as a Systemd Service (Optional but Recommended)
Create a service file:
```
sudo nano /etc/systemd/system/ansible-dashboard.service
```
Add the following content:
```
[Unit]
Description=Ansible Dashboard
After=network.target

[Service]
Type=simple
User=your_user  # Replace with appropriate user
WorkingDirectory=/opt/ansible-dashboard
ExecStart=/opt/ansible-dashboard/ansible-dashboard
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
Enable and start the service:
```
sudo systemctl daemon-reload
sudo systemctl enable ansible-dashboard
sudo systemctl start ansible-dashboard
```
# Access the Dashboard
Open your browser and navigate to:
```
http://your-server-ip:8080
```
