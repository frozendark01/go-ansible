document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const playbooksList = document.getElementById('playbooks-list');
    const detailsPanel = document.getElementById('details-panel');
    const executionDetails = document.getElementById('execution-details');
    const refreshBtn = document.getElementById('refreshBtn');
    const toast = document.getElementById('toast');
    
    // Current state
    let selectedPlaybook = null;
    let playbooks = [];
    
    // Event listeners
    refreshBtn.addEventListener('click', fetchPlaybooks);
    
    // Initial load
    fetchPlaybooks();
    
    // Functions
    function fetchPlaybooks() {
        showLoading(refreshBtn);
        
        fetch('/api/playbooks')
            .then(response => response.json())
            .then(data => {
                playbooks = data;
                renderPlaybooks();
                hideLoading(refreshBtn);
                showToast('Playbooks refreshed', 'info');
            })
            .catch(error => {
                console.error('Error fetching playbooks:', error);
                hideLoading(refreshBtn);
                showToast('Failed to fetch playbooks', 'error');
            });
    }
    
    function renderPlaybooks() {
        playbooksList.innerHTML = '';
        
        if (playbooks.length === 0) {
            playbooksList.innerHTML = '<p class="no-playbooks">No playbooks found</p>';
            return;
        }
        
        playbooks.forEach(playbook => {
            const card = document.createElement('div');
            card.className = 'card playbook-card';
            card.dataset.name = playbook.name;
            
            if (selectedPlaybook === playbook.name) {
                card.classList.add('selected');
            }
            
            let lastRunInfo = 'Never run';
            if (playbook.lastRunTime) {
                const date = new Date(playbook.lastRunTime);
                lastRunInfo = formatDate(date);
            }
            
            card.innerHTML = `
                <div class="header">
                    <span class="name">${playbook.name}</span>
                    <span class="status-badge status-${playbook.status.toLowerCase()}">${playbook.status}</span>
                </div>
                <div class="details">
                    <span class="path">${playbook.path}</span>
                    <span class="last-run">${lastRunInfo}</span>
                </div>
            `;
            
            card.addEventListener('click', () => selectPlaybook(playbook.name));
            playbooksList.appendChild(card);
        });
    }
    
    function selectPlaybook(name) {
        selectedPlaybook = name;
        renderPlaybooks();
        
        // Display loading state
        executionDetails.innerHTML = '<p class="loading">Loading playbook details...</p>';
        
        // Fetch playbook results
        fetch(`/api/result/${name}`)
            .then(response => response.json())
            .then(data => {
                renderPlaybookDetails(data);
            })
            .catch(error => {
                console.error('Error fetching playbook details:', error);
                executionDetails.innerHTML = '<p class="error">Failed to load playbook details</p>';
            });
    }
    
    function renderPlaybookDetails(result) {
        const playbook = playbooks.find(p => p.name === selectedPlaybook);
        
        if (!playbook) {
            executionDetails.innerHTML = '<p class="error">Playbook not found</p>';
            return;
        }
        
        const statusClass = result.success ? 'success' : 'failed';
        const statusText = result.success ? 'Success' : 'Failed';
        
        let content = `
            <div class="execution-header">
                <div class="execution-title">${playbook.name}</div>
                <button id="runBtn" class="btn primary">Run Playbook</button>
            </div>
        `;
        
        if (result.output) {
            content += `
                <div class="execution-output">${result.output}</div>
                <div class="execution-meta">
                    <span class="status status-${statusClass}">${statusText}</span>
                    <span class="runtime">Runtime: ${result.runTime || 'N/A'}</span>
                </div>
            `;
        } else {
            content += `
                <p class="no-output">No execution data available. Run the playbook to see output.</p>
            `;
        }
        
        executionDetails.innerHTML = content;
        
        // Add event listener to run button
        const runBtn = document.getElementById('runBtn');
        if (runBtn) {
            runBtn.addEventListener('click', () => runPlaybook(selectedPlaybook));
        }
    }
    
    function runPlaybook(playbookName) {
        const runBtn = document.getElementById('runBtn');
        showLoading(runBtn);
        
        fetch('/api/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ playbookName: playbookName }),
        })
        .then(response => response.json())
        .then(data => {
            hideLoading(runBtn);
            showToast(`Playbook ${playbookName} started`, 'info');
            
            // Poll for status updates
            pollPlaybookStatus(playbookName);
        })
        .catch(error => {
            console.error('Error running playbook:', error);
            hideLoading(runBtn);
            showToast('Failed to run playbook', 'error');
        });
    }
    
    function pollPlaybookStatus(playbookName) {
        // First refresh the playbooks list to get updated status
        fetch('/api/playbooks')
            .then(response => response.json())
            .then(data => {
                playbooks = data;
                renderPlaybooks();
                
                const playbook = playbooks.find(p => p.name === playbookName);
                
                if (playbook && playbook.status === 'Running') {
                    // Still running, poll again in 2 seconds
                    setTimeout(() => pollPlaybookStatus(playbookName), 2000);
                } else {
                    // Finished, fetch results
                    if (selectedPlaybook === playbookName) {
                        selectPlaybook(playbookName);
                    }
                    
                    if (playbook) {
                        const status = playbook.status === 'Success' ? 'success' : 'error';
                        showToast(`Playbook ${playbookName} completed: ${playbook.status}`, status);
                    }
                }
            })
            .catch(error => {
                console.error('Error polling playbook status:', error);
            });
    }
    
    // Utility functions
    function showLoading(button) {
        if (!button) return;
        button.disabled = true;
        button.innerHTML = 'Loading...';
    }
    
    function hideLoading(button) {
        if (!button) return;
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || button.textContent;
    }
    
    function formatDate(date) {
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString(undefined, options);
    }
    
    function showToast(message, type = 'info') {
        toast.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
});
