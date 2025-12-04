/**
 * Settings page logic for Bookmark XP Explorer
 * Manages user preferences for default view mode
 */

/** @type {HTMLInputElement} */
let fullpageToggle;

/** @type {HTMLElement} */
let saveStatus;

/**
 * Storage key for the default view mode preference
 * @type {string}
 */
const STORAGE_KEY = 'defaultViewMode';

/**
 * Possible view mode values
 * @readonly
 * @enum {string}
 */
const ViewMode = {
  FULLPAGE: 'fullpage',
  POPUP: 'popup'
};

/**
 * Detects if the user is on macOS.
 * @returns {boolean}
 */
function isMac() {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

/**
 * Updates keyboard shortcut hints for Mac users.
 * Replaces "Ctrl" with "Cmd" on macOS.
 * @returns {void}
 */
function updateKeyboardHints() {
  if (isMac()) {
    document.querySelectorAll('.mod-key').forEach(key => {
      if (key.textContent === 'Ctrl') {
        key.textContent = 'Cmd';
      }
    });
  }
}

/**
 * Shows a temporary save confirmation message.
 * @param {string} message - The message to display
 * @param {'success' | 'error'} type - The type of message
 * @returns {void}
 */
function showSaveStatus(message, type = 'success') {
  if (!saveStatus) return;

  saveStatus.textContent = message;
  saveStatus.classList.remove('success', 'error');
  saveStatus.classList.add(type);

  // Reset after 2 seconds
  setTimeout(() => {
    saveStatus.textContent = 'Settings are saved automatically.';
    saveStatus.classList.remove('success', 'error');
  }, 2000);
}

/**
 * Initializes the settings page by loading current preferences
 * and setting up event listeners.
 * @returns {Promise<void>}
 */
async function init() {
  fullpageToggle = document.getElementById('fullpage-default');
  saveStatus = document.getElementById('save-status');

  // Update keyboard hints for Mac users
  updateKeyboardHints();

  // Load current preference
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const currentMode = result[STORAGE_KEY] || ViewMode.FULLPAGE;

    // Set toggle state based on current preference
    fullpageToggle.checked = currentMode === ViewMode.FULLPAGE;
  } catch (error) {
    console.error('Failed to load settings:', error);
    // Default to fullpage mode if storage fails
    fullpageToggle.checked = true;
  }

  // Set up change listener
  fullpageToggle.addEventListener('change', handleToggleChange);

  // Load version from manifest
  loadVersion();
}

/**
 * Handles toggle switch changes by saving the new preference
 * and notifying the service worker.
 * @param {Event} event - The change event from the toggle
 * @returns {Promise<void>}
 */
async function handleToggleChange(event) {
  const isFullpage = event.target.checked;
  const newMode = isFullpage ? ViewMode.FULLPAGE : ViewMode.POPUP;

  try {
    // Save preference to storage
    await chrome.storage.local.set({ [STORAGE_KEY]: newMode });

    // Notify service worker to update action behavior
    try {
      await chrome.runtime.sendMessage({
        action: 'updateViewMode',
        mode: newMode
      });
    } catch (msgError) {
      // Service worker will pick up the change via storage listener
      // This is expected if the service worker is inactive
    }

    // Show success feedback
    const modeLabel = isFullpage ? 'Fullpage' : 'Popup';
    showSaveStatus(`✓ Default mode set to ${modeLabel}`, 'success');

  } catch (error) {
    console.error('Failed to save settings:', error);
    showSaveStatus('✕ Failed to save setting', 'error');
    // Revert toggle state
    event.target.checked = !isFullpage;
  }
}

/**
 * Loads and displays the extension version from manifest.
 * @returns {void}
 */
function loadVersion() {
  try {
    const manifest = chrome.runtime.getManifest();
    const versionElement = document.getElementById('version');
    if (versionElement && manifest.version) {
      versionElement.textContent = manifest.version;
    }
  } catch (error) {
    console.error('Failed to load version:', error);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
