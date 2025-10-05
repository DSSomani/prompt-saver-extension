// Content script for Prompt Saver extension
console.log('Prompt Saver content script loaded');

class PromptSaverContent {
  constructor() {
    // Core state
    this.prompts = [];
    this.disabledSites = [];
    this.currentHost = '';
    
    // Dropdown state
    this.isDropdownOpen = false;
    this.currentInput = null;
    this.filteredPrompts = [];
    this.selectedIndex = 0;
    this.hashPosition = 0;
    
    // Command prefixes
    this.TRIGGER_SYMBOL = '#';
    this.SAVE_COMMAND = 'prompt-save:';
    this.USE_COMMAND = 'use:';
    
    // MutationObserver for dynamic content
    this.observer = null;
    
    this.init();
  }
  
  async init() {
    await this.loadData();
    
    // Check if extension is enabled for current site
    if (this.isExtensionDisabled()) {
      console.log('Prompt Saver is disabled for this site');
      return;
    }
    
    this.attachEventListeners();
    this.setupMutationObserver();
  }
  
  async loadData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['prompts', 'disabledSites'], (result) => {
        this.prompts = result.prompts || [];
        this.disabledSites = result.disabledSites || [];
        this.currentHost = window.location.hostname;
        console.log('Prompts loaded:', this.prompts.length);
        resolve();
      });
    });
  }
  
  isExtensionDisabled() {
    return this.disabledSites.includes(this.currentHost);
  }
  
  attachEventListeners() {
    // Use capture phase for keydown to ensure we get events before the platform
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.addEventListener('input', this.handleInput.bind(this));
    document.addEventListener('click', this.handleClick.bind(this));
  }
  
  setupMutationObserver() {
    // Create a MutationObserver to detect new input fields added to the DOM
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Check if any new text inputs were added
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // If the node itself is a text input
              if (this.isTextInput(node)) {
                console.log('New text input detected:', node.tagName);
              }
              
              // Check children of the node for text inputs
              const textInputs = node.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]');
              if (textInputs.length > 0) {
                console.log('New text inputs detected within added node:', textInputs.length);
              }
            }
          });
        }
      }
    });
    
    // Start observing the document with the configured parameters
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
    
    console.log('MutationObserver setup complete');
  }
  
  handleKeyDown(event) {
    // Handle dropdown navigation
    if (this.isDropdownOpen) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          event.stopImmediatePropagation();
          this.selectNext();
          break;
        case 'ArrowUp':
          event.preventDefault();
          event.stopImmediatePropagation();
          this.selectPrevious();
          break;
        case 'Enter':
        case 'Tab':
          event.preventDefault();
          event.stopImmediatePropagation();
          this.insertSelectedPrompt();
          break;
        case 'Escape':
          event.preventDefault();
          event.stopImmediatePropagation();
          this.hideDropdown();
          break;
      }
      return;
    }

    // If not in dropdown, check for save command on Enter/Tab
    if (event.key === 'Enter' || event.key === 'Tab') {
      const target = event.target;
      if (!this.isTextInput(target)) return;
      const { value, cursorPos } = this.getInputValueAndCursor(target);
      if (typeof value === 'undefined' || typeof cursorPos === 'undefined') return;
      const textBeforeCursor = value.substring(0, cursorPos);
      if (this.checkForSaveCommand(textBeforeCursor, target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
  }
  
  handleInput(event) {
    const target = event.target;
    
    // Only process text inputs
    if (!this.isTextInput(target)) {
      return;
    }
    
    // Get text content and cursor position
    const { value, cursorPos } = this.getInputValueAndCursor(target);
    
    if (typeof value === 'undefined' || typeof cursorPos === 'undefined') {
      this.hideDropdown();
      return;
    }
    
    const textBeforeCursor = value.substring(0, cursorPos);
    
    // Only check for prompt use command here
    this.checkForUseCommand(textBeforeCursor, target);
  }
  
  checkForSaveCommand(text, inputElement) {
    const saveCommandRegex = new RegExp(`${this.TRIGGER_SYMBOL}${this.SAVE_COMMAND}([\\w-]+)\\s+(.+)$`);
    const match = text.match(saveCommandRegex);
    
    if (match) {
      const promptName = match[1];
      const promptContent = match[2];
      // Save the prompt
      this.savePrompt(promptName, promptContent);
      // Remove only the #prompt-save:[name] part, keep the prompt content
      const commandPattern = new RegExp(`${this.TRIGGER_SYMBOL}${this.SAVE_COMMAND}${promptName}\\s+`);
      const { value, cursorPos } = this.getInputValueAndCursor(inputElement);
      const textBeforeCursor = value.substring(0, cursorPos);
      const commandMatch = textBeforeCursor.match(commandPattern);
      if (commandMatch) {
        const start = textBeforeCursor.indexOf(commandMatch[0]);
        const end = start + commandMatch[0].length;
        this.replaceTextInInput(inputElement, start, end, '');
      }
      return true;
    }
    
    return false;
  }
  
  checkForUseCommand(text, inputElement) {
    // Hide any existing dropdown
    this.hideDropdown();
    
    // Find the last hash symbol before cursor
    const lastHashIndex = text.lastIndexOf(this.TRIGGER_SYMBOL);
    
    if (lastHashIndex === -1) {
      return;
    }
    
    // Check if hash is at start of line or after whitespace
    const charBeforeHash = lastHashIndex > 0 ? text[lastHashIndex - 1] : ' ';
    if (!/\s/.test(charBeforeHash) && lastHashIndex !== 0) {
      return;
    }
    
    // Get the text after the hash symbol
    const searchTerm = text.substring(lastHashIndex + 1);
    
    // If there's a space after the hash, hide dropdown
    if (searchTerm.includes(' ')) {
      // Check if it's a complete use command
      const useCommandRegex = new RegExp(`^${this.USE_COMMAND}([\\w-]+)$`);
      const match = searchTerm.match(useCommandRegex);
      
      if (match) {
        const promptName = match[1];
        this.insertPromptByName(promptName, inputElement, lastHashIndex);
      }
      
      return;
    }
    
    // Show dropdown with filtered prompts
    this.currentInput = inputElement;
    this.hashPosition = lastHashIndex;
    this.filterAndShowPrompts(searchTerm);
  }
  
  savePrompt(name, content) {
    // Check if prompt with this name already exists
    const existingIndex = this.prompts.findIndex(p => p.title.toLowerCase() === name.toLowerCase());
    
    if (existingIndex !== -1) {
      // Update existing prompt
      this.prompts[existingIndex].content = content;
    } else {
      // Create new prompt
      const newPrompt = {
        id: Date.now().toString(),
        title: name,
        content: content
      };
      this.prompts.push(newPrompt);
    }
    
    // Save to storage
    chrome.storage.local.set({ prompts: this.prompts }, () => {
      this.showSnackbar('Prompt saved!');
      console.log(`Prompt "${name}" saved successfully`);
    });
  }
  
  insertPromptByName(name, inputElement, hashPosition) {
    const prompt = this.prompts.find(p => p.title.toLowerCase() === name.toLowerCase());
    
    if (prompt) {
      const { value, cursorPos } = this.getInputValueAndCursor(inputElement);
      const commandText = value.substring(hashPosition, cursorPos);
      
      this.replaceTextInInput(
        inputElement,
        hashPosition,
        hashPosition + commandText.length,
        prompt.content
      );
    }
  }
  
  removeCommandFromInput(inputElement, commandText) {
    const { value, cursorPos } = this.getInputValueAndCursor(inputElement);
    const commandStart = value.lastIndexOf(commandText);
    
    if (commandStart !== -1) {
      this.replaceTextInInput(
        inputElement,
        commandStart,
        commandStart + commandText.length,
        ''
      );
    }
  }
  
  replaceTextInInput(inputElement, startPos, endPos, newText) {
    if (inputElement.isContentEditable) {
      // Handle contentEditable elements
      const selection = window.getSelection();
      const range = document.createRange();
      
      // Create a temporary element to hold the text content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = inputElement.innerHTML;
      
      // Find the text node containing the start position
      let currentPos = 0;
      let targetNode = null;
      let targetOffset = 0;
      
      function findPosition(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const nodeLength = node.textContent.length;
          if (currentPos + nodeLength >= startPos) {
            targetNode = node;
            targetOffset = startPos - currentPos;
            return true;
          }
          currentPos += nodeLength;
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            if (findPosition(node.childNodes[i])) {
              return true;
            }
          }
        }
        return false;
      }
      
      findPosition(inputElement);
      
      if (targetNode) {
        const beforeText = targetNode.textContent.substring(0, targetOffset);
        const afterText = targetNode.textContent.substring(targetOffset + (endPos - startPos));
        targetNode.textContent = beforeText + newText + afterText;
      }
    } else {
      // Handle standard input elements
      const newValue = 
        inputElement.value.substring(0, startPos) + 
        newText + 
        inputElement.value.substring(endPos);
      
      inputElement.value = newValue;
      
      // Set cursor position after inserted text
      const newCursorPos = startPos + newText.length;
      inputElement.setSelectionRange(newCursorPos, newCursorPos);
    }
    
    // Trigger input event for any listeners
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  handleClick(event) {
    if (this.isDropdownOpen && !event.target.closest('.prompt-dropdown')) {
      this.hideDropdown();
    }
  }
  
  getInputValueAndCursor(element) {
    if (element.isContentEditable) {
      return {
        value: element.textContent,
        cursorPos: this.getContentEditableCursorPosition(element)
      };
    } else {
      return {
        value: element.value,
        cursorPos: element.selectionStart
      };
    }
  }
  
  getContentEditableCursorPosition(element) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      return preCaretRange.toString().length;
    }
    return 0;
  }
  
  isTextInput(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    return (
      tagName === 'textarea' ||
      (tagName === 'input' && /^(text|search|email|url|tel|password)$/.test(element.type)) ||
      element.isContentEditable
    );
  }
  
  filterAndShowPrompts(searchTerm) {
    // Special case for use: command
    if (searchTerm.startsWith(this.USE_COMMAND)) {
      const nameFilter = searchTerm.substring(this.USE_COMMAND.length);
      this.filteredPrompts = this.prompts.filter(prompt =>
        prompt.title.toLowerCase().includes(nameFilter.toLowerCase())
      );
    } else {
      // Regular filtering
      this.filteredPrompts = this.prompts.filter(prompt =>
        prompt.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    this.selectedIndex = 0;
    
    if (this.filteredPrompts.length > 0) {
      this.showDropdown();
    }
  }
  
  showDropdown() {
    this.hideDropdown(); 
    
    const dropdown = document.createElement('div');
    dropdown.className = 'prompt-dropdown';
    document.body.appendChild(dropdown);
    
    this.updateDropdownContent();
    this.positionDropdown();
    this.isDropdownOpen = true;
  }
  
  updateDropdownContent() {
    const dropdown = document.querySelector('.prompt-dropdown');
    if (!dropdown) return;
    
    dropdown.innerHTML = `
      <div class="prompt-dropdown-content">
        ${this.filteredPrompts.map((prompt, index) => `
          <div class="prompt-item ${index === this.selectedIndex ? 'selected' : ''}" data-index="${index}">
            <div class="prompt-title">${this.escapeHtml(prompt.title)}</div>
            <div class="prompt-preview">${this.escapeHtml(prompt.content.substring(0, 80))}${prompt.content.length > 80 ? '...' : ''}</div>
          </div>
        `).join('')}
      </div>
    `;
    
    dropdown.querySelectorAll('.prompt-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.selectedIndex = index;
        this.insertSelectedPrompt();
      });
    });
  }
  
  positionDropdown() {
    const dropdown = document.querySelector('.prompt-dropdown');
    if (!dropdown || !this.currentInput) return;
    
    const inputRect = this.currentInput.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    
    // Position dropdown based on available space
    const spaceBelow = window.innerHeight - inputRect.bottom;
    const spaceAbove = inputRect.top;
    
    if (spaceBelow >= 200 || spaceBelow > spaceAbove) {
      // Position below
      dropdown.style.top = `${inputRect.bottom + 5}px`;
      dropdown.style.bottom = 'auto';
    } else {
      // Position above
      dropdown.style.bottom = `${window.innerHeight - inputRect.top + 5}px`;
      dropdown.style.top = 'auto';
    }
    
    dropdown.style.left = `${inputRect.left + window.scrollX}px`;
    dropdown.style.width = `${Math.max(250, inputRect.width)}px`;
    dropdown.style.zIndex = '2147483647'; // Maximum z-index value
  }
  
  selectNext() {
    this.selectedIndex = (this.selectedIndex + 1) % this.filteredPrompts.length;
    this.updateDropdownContent();
  }
  
  selectPrevious() {
    this.selectedIndex = (this.selectedIndex - 1 + this.filteredPrompts.length) % this.filteredPrompts.length;
    this.updateDropdownContent();
  }
  
  insertSelectedPrompt() {
    if (!this.isDropdownOpen || this.filteredPrompts.length === 0) {
      return;
    }
    
    const selectedPrompt = this.filteredPrompts[this.selectedIndex];
    const input = this.currentInput;
    
    // Get the text after the hash symbol
    const { value, cursorPos } = this.getInputValueAndCursor(input);
    const textBeforeCursor = value.substring(0, cursorPos);
    const commandText = textBeforeCursor.substring(this.hashPosition);
    
    // Replace the command with the prompt content
    this.replaceTextInInput(
      input,
      this.hashPosition,
      this.hashPosition + commandText.length,
      selectedPrompt.content
    );
    
    this.hideDropdown();
  }
  
  hideDropdown() {
    const dropdown = document.querySelector('.prompt-dropdown');
    if (dropdown) {
      dropdown.remove();
    }
    this.isDropdownOpen = false;
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  showSnackbar(message) {
    let snackbar = document.getElementById('prompt-saver-snackbar');
    if (!snackbar) {
      snackbar = document.createElement('div');
      snackbar.id = 'prompt-saver-snackbar';
      snackbar.style.position = 'fixed';
      snackbar.style.left = '50%';
      snackbar.style.bottom = '40px';
      snackbar.style.transform = 'translateX(-50%)';
      snackbar.style.background = 'rgba(60,60,60,0.97)';
      snackbar.style.color = '#fff';
      snackbar.style.padding = '12px 28px';
      snackbar.style.borderRadius = '6px';
      snackbar.style.fontSize = '1rem';
      snackbar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
      snackbar.style.zIndex = '2147483647';
      snackbar.style.opacity = '0';
      snackbar.style.pointerEvents = 'none';
      snackbar.style.transition = 'opacity 0.3s';
      document.body.appendChild(snackbar);
    }
    snackbar.textContent = message;
    snackbar.style.opacity = '1';
    setTimeout(() => {
      snackbar.style.opacity = '0';
    }, 2000);
  }

  // Clean up resources when extension is unloaded
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    document.removeEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.removeEventListener('input', this.handleInput.bind(this));
    document.removeEventListener('click', this.handleClick.bind(this));
  }
}

// Initialize the content script
const promptSaver = new PromptSaverContent();

// Clean up when extension is unloaded
window.addEventListener('unload', () => {
  if (promptSaver) {
    promptSaver.cleanup();
  }
});
