# Prompt Saver Extension

Prompt Saver is a browser extension that lets you save, manage, and quickly reuse your favorite prompts for AI chatbots and productivity tools. Easily store prompt templates, organize them by name, and insert them into any input field with a simple shortcut.

## Features
- Save custom prompts with a title and content
- Use prompts anywhere by typing `#name` or selecting from a dropdown
- Quickly add new prompts via the popup UI
- Enable or disable the extension per site
- Delete or update saved prompts
- Usage instructions and keyboard navigation

## How to Use
1. Click the extension icon to open the popup.
2. Add a new prompt by entering a title and content, then click "Save Prompt".
3. Use your saved prompts by typing `#name` in any input field, or start typing `#` to see suggestions.
4. Manage prompts from the popup: update, delete, or add new ones.
5. Toggle the extension on/off for the current site using the switch at the top.

## Usage Instructions
<!-- - **Save a prompt:** Type `#prompt-save:name` followed by your prompt text in any input field. -->
- **Use a prompt:** Type `#name` or start typing `#` to see available prompts.
- Use arrow keys to navigate, Enter/Tab to select.

## Development
- All extension code is in the root and `popup/` directories.
- Main files: `background.js`, `content.js`, `popup/popup.js`, `popup/popup.html`, `manifest.json`.

## License
MIT
# prompt-saver-extension
