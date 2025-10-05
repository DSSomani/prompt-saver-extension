class PromptSaverPopup {
  constructor() {
    this.prompts = [];
    this.disabledSites = [];
    this.currentHost = '';
    this.init();
  }
  
  init() {
    // Main event listeners
    document.getElementById('savePrompt').addEventListener('click', this.savePrompt.bind(this));
    document.getElementById('siteToggle').addEventListener('change', this.handleSiteToggle.bind(this));
    
    // Event delegation for dynamic delete buttons
    document.getElementById('promptsList').addEventListener('click', (event) => {
      if (event.target.classList.contains('delete-btn')) {
        const promptId = event.target.getAttribute('data-prompt-id');
        this.deletePrompt(promptId);
      }
    });

    // Load data and initialize
    chrome.storage.local.get(['prompts', 'disabledSites'], (result) => {
      this.prompts = result.prompts || [];
      this.disabledSites = result.disabledSites || [];
      this.renderPrompts();
      this.initializeSiteToggle();
    });
  }
  
  initializeSiteToggle() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        try {
          const url = new URL(tabs[0].url);
          this.currentHost = url.hostname;
          document.getElementById('currentHost').textContent = this.currentHost;
          
          const isEnabled = !this.disabledSites.includes(this.currentHost);
          document.getElementById('siteToggle').checked = isEnabled;
          document.getElementById('mainContent').style.display = isEnabled ? 'block' : 'none';
        } catch (e) {
          document.querySelector('.site-settings').style.display = 'none';
        }
      }
    });
  }

  handleSiteToggle(event) {
    const isEnabled = event.target.checked;
    
    if (isEnabled) {
      this.disabledSites = this.disabledSites.filter(site => site !== this.currentHost);
      document.getElementById('mainContent').style.display = 'block';
    } else {
      if (!this.disabledSites.includes(this.currentHost)) {
        this.disabledSites.push(this.currentHost);
      }
      document.getElementById('mainContent').style.display = 'none';
    }
    
    chrome.storage.local.set({ disabledSites: this.disabledSites });
  }

  renderPrompts() {
    const promptsList = document.getElementById('promptsList');
    
    if (this.prompts.length === 0) {
      promptsList.innerHTML = '<div class="empty-state">No prompts saved yet.</div>';
      return;
    }
    
    promptsList.innerHTML = this.prompts.map(prompt => `
      <div class="prompt-item" data-id="${prompt.id}">
        <button class="delete-btn" data-prompt-id="${prompt.id}" title="Delete prompt">×</button>
        <div class="prompt-title">${this.escapeHtml(prompt.title)}</div>
        <div class="prompt-content">${this.escapeHtml(prompt.content)}</div>
        <div class="prompt-usage">
          <code>#${prompt.title}</code>
        </div>
      </div>
    `).join('');
  }
  
  savePrompt() {
    const titleInput = document.getElementById('promptTitle');
    const contentInput = document.getElementById('promptContent');
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    
    if (!title || !content) {
      alert('Please enter both title and content.');
      return;
    }
    
    // Validate title (allow letters, numbers, underscores, hyphens, spaces, slashes, colons, and periods)
    if (!/^[\w\-\/\:\. ]+$/.test(title)) {
      alert('Prompt name can only contain letters, numbers, underscores, hyphens, spaces, slashes, colons, and periods.');
      return;
    }
    
    // Check if prompt with this name already exists
    const existingPrompt = this.prompts.find(p => p.title.toLowerCase() === title.toLowerCase());
    
    if (existingPrompt && !confirm(`A prompt named "${title}" already exists. Do you want to update it?`)) {
      return;
    }
    
    chrome.runtime.sendMessage({
      action: 'savePrompt',
      title: title,
      content: content
    }, (response) => {
      if (response.success) {
        titleInput.value = '';
        contentInput.value = '';
        
        // Reload prompts to update the list
        chrome.storage.local.get(['prompts'], (result) => {
          this.prompts = result.prompts || [];
          this.renderPrompts();
        });
      }
    });
  }
  
  deletePrompt(promptId) {
    if (!confirm('Are you sure you want to delete this prompt?')) {
      return;
    }
    
    chrome.runtime.sendMessage({
      action: 'deletePrompt',
      promptId: promptId
    }, (response) => {
      if (response.success) {
        // Reload prompts to update the list
        chrome.storage.local.get(['prompts'], (result) => {
          this.prompts = result.prompts || [];
          this.renderPrompts();
        });
      }
    });
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the popup
new PromptSaverPopup();
