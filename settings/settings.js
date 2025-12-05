/**
 * Settings page logic for Bookmark XP Explorer
 * Manages user preferences for default view mode and theme
 */

/** @type {HTMLInputElement} */
let fullpageToggle

/** @type {HTMLElement} */
let saveStatus

/** @type {NodeListOf<HTMLInputElement>} */
let themeRadios

/**
 * Storage key for the default view mode preference
 * @type {string}
 */
const STORAGE_KEY = 'defaultViewMode'

/**
 * Storage key for the theme preference
 * @type {string}
 */
const THEME_STORAGE_KEY = 'theme'

/**
 * Possible view mode values
 * @readonly
 * @enum {string}
 */
const ViewMode = {
  FULLPAGE: 'fullpage',
  POPUP: 'popup',
}

/**
 * Possible theme values
 * @readonly
 * @enum {string}
 */
const Theme = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
}

/**
 * Detects if the user is on macOS.
 * @returns {boolean}
 */
function isMac() {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
}

/**
 * Updates keyboard shortcut hints for Mac users.
 * Replaces "Ctrl" with "Cmd" on macOS.
 * @returns {void}
 */
function updateKeyboardHints() {
  if (isMac()) {
    document.querySelectorAll('.mod-key').forEach((key) => {
      if (key.textContent === 'Ctrl') {
        key.textContent = 'Cmd'
      }
    })
  }
}

/**
 * Shows a temporary save confirmation message.
 * @param {string} message - The message to display
 * @param {'success' | 'error'} type - The type of message
 * @returns {void}
 */
function showSaveStatus(message, type = 'success') {
  if (!saveStatus) return

  saveStatus.textContent = message
  saveStatus.classList.remove('success', 'error')
  saveStatus.classList.add(type)

  // Reset after 2 seconds
  setTimeout(() => {
    saveStatus.textContent = 'Settings are saved automatically.'
    saveStatus.classList.remove('success', 'error')
  }, 2000)
}

/**
 * Applies the theme to the document based on the preference.
 * @param {string} theme - The theme preference ('light', 'dark', or 'system')
 * @returns {void}
 */
function applyTheme(theme) {
  const root = document.documentElement

  if (theme === Theme.SYSTEM) {
    // Remove data-theme to let CSS media query handle it
    root.removeAttribute('data-theme')
  } else {
    // Apply explicit theme
    root.setAttribute('data-theme', theme)
  }
}

/**
 * Handles theme radio button changes.
 * @param {Event} event - The change event from the radio button
 * @returns {Promise<void>}
 */
async function handleThemeChange(event) {
  const newTheme = event.target.value

  // Apply theme immediately for instant visual feedback
  applyTheme(newTheme)

  try {
    // Save preference to storage
    await chrome.storage.local.set({ [THEME_STORAGE_KEY]: newTheme })

    // Show success feedback
    const themeLabels = {
      [Theme.LIGHT]: 'Light',
      [Theme.DARK]: 'Dark',
      [Theme.SYSTEM]: 'System',
    }
    showSaveStatus(`✓ Theme set to ${themeLabels[newTheme]}`, 'success')
  } catch (error) {
    console.error('Failed to save theme:', error)
    showSaveStatus('✕ Failed to save theme', 'error')
  }
}

/**
 * Initializes the settings page by loading current preferences
 * and setting up event listeners.
 * @returns {Promise<void>}
 */
async function init() {
  fullpageToggle = document.getElementById('fullpage-default')
  saveStatus = document.getElementById('save-status')
  themeRadios = document.querySelectorAll('input[name="theme"]')

  // Update keyboard hints for Mac users
  updateKeyboardHints()

  // Load current preferences
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEY,
      THEME_STORAGE_KEY,
    ])

    // View mode preference
    const currentMode = result[STORAGE_KEY] || ViewMode.FULLPAGE
    fullpageToggle.checked = currentMode === ViewMode.FULLPAGE

    // Theme preference - default to light
    const currentTheme = result[THEME_STORAGE_KEY] || Theme.LIGHT
    themeRadios.forEach((radio) => {
      radio.checked = radio.value === currentTheme
    })

    // Apply theme to settings page
    applyTheme(currentTheme)
  } catch (error) {
    console.error('Failed to load settings:', error)
    // Default to fullpage mode and light theme if storage fails
    fullpageToggle.checked = true
    themeRadios.forEach((radio) => {
      radio.checked = radio.value === Theme.LIGHT
    })
  }

  // Set up change listeners
  fullpageToggle.addEventListener('change', handleToggleChange)
  themeRadios.forEach((radio) => {
    radio.addEventListener('change', handleThemeChange)
  })

  // Load version from manifest
  loadVersion()
}

/**
 * Handles toggle switch changes by saving the new preference
 * and notifying the service worker.
 * @param {Event} event - The change event from the toggle
 * @returns {Promise<void>}
 */
async function handleToggleChange(event) {
  const isFullpage = event.target.checked
  const newMode = isFullpage ? ViewMode.FULLPAGE : ViewMode.POPUP

  try {
    // Save preference to storage
    await chrome.storage.local.set({ [STORAGE_KEY]: newMode })

    // Notify service worker to update action behavior
    try {
      await chrome.runtime.sendMessage({
        action: 'updateViewMode',
        mode: newMode,
      })
    } catch (msgError) {
      // Service worker will pick up the change via storage listener
      // This is expected if the service worker is inactive
    }

    // Show success feedback
    const modeLabel = isFullpage ? 'Fullpage' : 'Popup'
    showSaveStatus(`✓ Default mode set to ${modeLabel}`, 'success')
  } catch (error) {
    console.error('Failed to save settings:', error)
    showSaveStatus('✕ Failed to save setting', 'error')
    // Revert toggle state
    event.target.checked = !isFullpage
  }
}

/**
 * Loads and displays the extension version from manifest.
 * @returns {void}
 */
function loadVersion() {
  try {
    const manifest = chrome.runtime.getManifest()
    const versionElement = document.getElementById('version')
    if (versionElement && manifest.version) {
      versionElement.textContent = manifest.version
    }
  } catch (error) {
    console.error('Failed to load version:', error)
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init)
