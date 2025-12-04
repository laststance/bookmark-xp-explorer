/**
 * Bookmark XP Explorer - Service Worker
 * Background script for Chrome extension
 *
 * Handles:
 * - Extension lifecycle (install, startup)
 * - Dynamic popup/fullpage switching based on user preference
 * - Keyboard shortcuts
 * - Bookmark change events
 */

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
 * URLs for extension pages
 * @readonly
 */
const Pages = {
  FULLPAGE: 'fullpage/fullpage.html',
  POPUP: 'popup/popup.html'
};

/**
 * Applies the view mode preference by configuring the action popup behavior.
 * When fullpage mode is active, removes the popup so onClicked fires.
 * When popup mode is active, sets the popup URL.
 *
 * @param {string} mode - The view mode ('fullpage' or 'popup')
 * @returns {Promise<void>}
 */
async function applyViewModePreference(mode) {
  if (mode === ViewMode.FULLPAGE) {
    // Remove popup so clicking icon triggers onClicked event
    await chrome.action.setPopup({ popup: '' });
    console.log('View mode: Fullpage (click opens new tab)');
  } else {
    // Set popup URL for traditional popup behavior
    await chrome.action.setPopup({ popup: Pages.POPUP });
    console.log('View mode: Popup (click opens popup)');
  }
}

/**
 * Loads the current view mode preference from storage and applies it.
 * Defaults to fullpage mode if no preference is stored.
 *
 * @returns {Promise<void>}
 */
async function loadAndApplyPreference() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const mode = result[STORAGE_KEY] || ViewMode.FULLPAGE;
  await applyViewModePreference(mode);
}

/**
 * Opens the fullpage bookmark explorer in a new tab.
 * Reuses existing fullpage tab if one is already open.
 *
 * @returns {Promise<void>}
 */
async function openFullPage() {
  const fullpageUrl = chrome.runtime.getURL(Pages.FULLPAGE);

  // Check if fullpage is already open
  const tabs = await chrome.tabs.query({ url: fullpageUrl });

  if (tabs.length > 0) {
    // Focus existing tab
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    // Open new tab
    await chrome.tabs.create({ url: fullpageUrl });
  }
}

// ============================================================================
// Event Listeners
// ============================================================================

/**
 * Extension installed/updated event handler.
 * Sets default preference on first install and opens fullpage.
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Bookmark XP Explorer installed:', details.reason);

  if (details.reason === 'install') {
    console.log('Welcome to Bookmark XP Explorer!');

    // Set default preference to fullpage mode
    await chrome.storage.local.set({ [STORAGE_KEY]: ViewMode.FULLPAGE });

    // Apply the preference immediately
    await applyViewModePreference(ViewMode.FULLPAGE);

    // Open fullpage on first install
    await openFullPage();
  } else if (details.reason === 'update') {
    // On update, load existing preference or set new default
    const result = await chrome.storage.local.get(STORAGE_KEY);
    if (!result[STORAGE_KEY]) {
      // Existing users: set default to fullpage (new feature)
      await chrome.storage.local.set({ [STORAGE_KEY]: ViewMode.FULLPAGE });
    }
    await loadAndApplyPreference();
  }
});

/**
 * Extension startup event handler.
 * Applies saved preference when browser starts.
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('Bookmark XP Explorer starting up...');
  await loadAndApplyPreference();
});

/**
 * Action icon clicked event handler.
 * Only fires when popup is disabled (fullpage mode).
 */
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Action icon clicked, opening fullpage...');
  await openFullPage();
});

/**
 * Keyboard shortcut handler.
 * Cmd/Ctrl+Shift+B opens fullpage regardless of mode setting.
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-fullpage') {
    await openFullPage();
  }
});

/**
 * Message listener for communication with popup/settings pages.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openFullPage') {
    openFullPage().then(() => sendResponse({ success: true }));
    return true; // Keep channel open for async response
  }

  if (message.action === 'updateViewMode') {
    applyViewModePreference(message.mode)
      .then(() => sendResponse({ success: true }));
    return true; // Keep channel open for async response
  }

  return false;
});

/**
 * Storage change listener.
 * Reapplies preference when changed from settings page.
 * This is a backup for when service worker wakes up after settings change.
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes[STORAGE_KEY]) {
    const newMode = changes[STORAGE_KEY].newValue;
    console.log('Storage changed, applying new view mode:', newMode);
    applyViewModePreference(newMode);
  }
});

// ============================================================================
// Bookmark Event Logging (for debugging)
// ============================================================================

chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  console.log('Bookmark created:', bookmark.title);
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
  console.log('Bookmark removed:', id);
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
  console.log('Bookmark changed:', changeInfo);
});

chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
  console.log('Bookmark moved:', id);
});

// Apply preference immediately when service worker loads
loadAndApplyPreference();
