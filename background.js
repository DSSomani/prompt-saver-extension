// Background service worker for the Prompt Saver extension
console.log('Prompt Saver Extension initialized');

// Initialize extension on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Prompt Saver Extension installed');
  
  // Initialize storage with default prompts
  chrome.storage.local.get(['prompts'], (result) => {
    if (!result.prompts) {
      const defaultPrompts = [
        {
          id: 'explain',
          title: 'explain',
          content: 'Explain the following concept in simple terms:'
        },
        {
          id: 'improve',
          title: 'improve',
          content: 'Please improve the following text:'
        },
        {
          id: 'debug',
          title: 'debug',
          content: 'Help me debug this code:'
        }
      ];
      
      chrome.storage.local.set({ prompts: defaultPrompts });
    }
  });
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Get all prompts
  if (request.action === 'getPrompts') {
    chrome.storage.local.get(['prompts'], (result) => {
      sendResponse({ prompts: result.prompts || [] });
    });
    return true; // Keep message channel open for async response
  }
  
  // Save a new prompt
  if (request.action === 'savePrompt') {
    chrome.storage.local.get(['prompts'], (result) => {
      const prompts = result.prompts || [];
      
      // Check if prompt with this name already exists
      const existingIndex = prompts.findIndex(p => p.title.toLowerCase() === request.title.toLowerCase());
      
      if (existingIndex !== -1) {
        // Update existing prompt
        prompts[existingIndex].content = request.content;
      } else {
        // Create new prompt
        const newPrompt = {
          id: Date.now().toString(),
          title: request.title,
          content: request.content
        };
        prompts.push(newPrompt);
      }
      
      chrome.storage.local.set({ prompts }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
  
  // Delete a prompt
  if (request.action === 'deletePrompt') {
    chrome.storage.local.get(['prompts'], (result) => {
      const prompts = result.prompts || [];
      const updatedPrompts = prompts.filter(p => p.id !== request.promptId);
      
      chrome.storage.local.set({ prompts: updatedPrompts }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
});
