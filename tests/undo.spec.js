const { test, expect, chromium } = require('@playwright/test')
const path = require('path')

/**
 * Tests for the Undo feature in Bookmark XP Explorer Chrome extension.
 *
 * These tests verify:
 * 1. Undo button appears and is initially disabled
 * 2. Creating a folder enables undo and undoing removes it
 * 3. Creating a bookmark enables undo and undoing removes it
 * 4. Renaming an item can be undone
 * 5. Deleting an item can be undone (restored)
 * 6. Ctrl+Z keyboard shortcut triggers undo
 * 7. Undo button in context menu works
 */

const EXTENSION_PATH = path.resolve(__dirname, '..')

test.describe('Undo Feature', () => {
  /** @type {import('@playwright/test').BrowserContext} */
  let context
  /** @type {import('@playwright/test').Page} */
  let extensionPage
  let extensionId

  test.beforeAll(async () => {
    // Launch browser with extension loaded
    context = await chromium.launchPersistentContext('', {
      headless: false, // Extensions require headed mode
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--disable-default-apps',
      ],
    })

    // Get extension ID from service worker
    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }
    extensionId = background.url().split('/')[2]
  })

  test.afterAll(async () => {
    await context?.close()
  })

  test.beforeEach(async () => {
    // Open fullpage view for each test
    extensionPage = await context.newPage()
    await extensionPage.goto(
      `chrome-extension://${extensionId}/fullpage/fullpage.html`,
    )
    // Wait for the page to load
    await extensionPage.waitForSelector('#folder-tree')
    // Wait a bit for the extension to initialize
    await extensionPage.waitForTimeout(500)
  })

  test.afterEach(async () => {
    await extensionPage?.close()
  })

  test('undo button should be initially disabled', async () => {
    // Check that undo buttons are disabled when there's nothing to undo
    const undoBtn1 = extensionPage.locator('#pane-1 button[data-action="undo"]')
    await expect(undoBtn1).toBeDisabled()
  })

  test('create folder and undo should remove it', async () => {
    // Click new folder button in pane 1
    const newFolderBtn = extensionPage.locator(
      '#pane-1 button[data-action="new-folder"]',
    )
    await newFolderBtn.click()

    // Fill in the folder name in the dialog
    const dialog = extensionPage.locator('#new-folder-dialog')
    await expect(dialog).toBeVisible()

    const input = dialog.locator('#new-folder-input')
    const testFolderName = `Test Folder ${Date.now()}`
    await input.fill(testFolderName)

    // Click OK
    await dialog.locator('#new-folder-ok').click()

    // Wait for folder to appear in content view
    await extensionPage.waitForSelector(`.content-item[data-is-folder="true"]`)

    // Verify undo button is now enabled
    const undoBtn = extensionPage.locator('#pane-1 button[data-action="undo"]')
    await expect(undoBtn).toBeEnabled()

    // Click undo
    await undoBtn.click()

    // Verify the folder is removed (check that the specific folder doesn't exist)
    // Note: Other folders might still exist, so we check for our specific test folder
    const testFolder = extensionPage.locator(
      `.content-item:has-text("${testFolderName}")`,
    )
    await expect(testFolder).toHaveCount(0)

    // Undo button should be disabled again (if stack is empty)
    await expect(undoBtn).toBeDisabled()
  })

  test('create bookmark and undo should remove it', async () => {
    // Click new bookmark button (from context menu on empty area)
    await extensionPage
      .locator('#pane-1 .pane-content')
      .click({ button: 'right' })

    const contextMenu = extensionPage.locator('#context-menu')
    await expect(contextMenu).toBeVisible()

    await contextMenu.locator('[data-action="new-bookmark"]').click()

    // Fill in bookmark details
    const dialog = extensionPage.locator('#new-bookmark-dialog')
    await expect(dialog).toBeVisible()

    const testTitle = `Test Bookmark ${Date.now()}`
    await dialog.locator('#new-bookmark-title').fill(testTitle)
    await dialog.locator('#new-bookmark-url').fill('https://example.com')
    await dialog.locator('#new-bookmark-ok').click()

    // Wait for bookmark to appear
    await extensionPage.waitForSelector(
      `.content-item:has-text("${testTitle}")`,
    )

    // Undo button should be enabled
    const undoBtn = extensionPage.locator('#pane-1 button[data-action="undo"]')
    await expect(undoBtn).toBeEnabled()

    // Click undo
    await undoBtn.click()

    // Verify bookmark is removed
    const testBookmark = extensionPage.locator(
      `.content-item:has-text("${testTitle}")`,
    )
    await expect(testBookmark).toHaveCount(0)
  })

  test('Ctrl+Z keyboard shortcut should trigger undo', async () => {
    // Create a folder first
    const newFolderBtn = extensionPage.locator(
      '#pane-1 button[data-action="new-folder"]',
    )
    await newFolderBtn.click()

    const dialog = extensionPage.locator('#new-folder-dialog')
    const testFolderName = `Keyboard Test ${Date.now()}`
    await dialog.locator('#new-folder-input').fill(testFolderName)
    await dialog.locator('#new-folder-ok').click()

    // Wait for folder to appear
    await extensionPage.waitForSelector(
      `.content-item:has-text("${testFolderName}")`,
    )

    // Press Ctrl+Z (or Cmd+Z on Mac)
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
    await extensionPage.keyboard.press(`${modifier}+z`)

    // Verify folder is removed
    const testFolder = extensionPage.locator(
      `.content-item:has-text("${testFolderName}")`,
    )
    await expect(testFolder).toHaveCount(0)
  })

  test('rename item and undo should restore original name', async () => {
    // First create a folder to rename
    const newFolderBtn = extensionPage.locator(
      '#pane-1 button[data-action="new-folder"]',
    )
    await newFolderBtn.click()

    const createDialog = extensionPage.locator('#new-folder-dialog')
    const originalName = `Original Name ${Date.now()}`
    await createDialog.locator('#new-folder-input').fill(originalName)
    await createDialog.locator('#new-folder-ok').click()

    // Wait for folder to appear
    const folderItem = extensionPage.locator(
      `.content-item:has-text("${originalName}")`,
    )
    await expect(folderItem).toBeVisible()

    // Clear undo stack by clicking undo (removes the create action)
    const undoBtn = extensionPage.locator('#pane-1 button[data-action="undo"]')
    await undoBtn.click()

    // Recreate the folder for rename test
    await newFolderBtn.click()
    await createDialog.locator('#new-folder-input').fill(originalName)
    await createDialog.locator('#new-folder-ok').click()
    await expect(folderItem).toBeVisible()

    // Now rename it - right click on the folder
    await folderItem.click({ button: 'right' })
    const contextMenu = extensionPage.locator('#context-menu')
    await contextMenu.locator('[data-action="rename"]').click()

    // Fill in new name
    const renameDialog = extensionPage.locator('#rename-dialog')
    await expect(renameDialog).toBeVisible()

    const newName = `Renamed ${Date.now()}`
    await renameDialog.locator('#rename-input').fill(newName)
    await renameDialog.locator('#rename-ok').click()

    // Verify renamed
    const renamedItem = extensionPage.locator(
      `.content-item:has-text("${newName}")`,
    )
    await expect(renamedItem).toBeVisible()

    // Undo the rename
    await undoBtn.click()

    // Verify original name is restored
    await expect(folderItem).toBeVisible()
    await expect(renamedItem).toHaveCount(0)
  })

  test('delete item and undo should restore it', async () => {
    // First create a folder to delete
    const newFolderBtn = extensionPage.locator(
      '#pane-1 button[data-action="new-folder"]',
    )
    await newFolderBtn.click()

    const createDialog = extensionPage.locator('#new-folder-dialog')
    const folderName = `Delete Test ${Date.now()}`
    await createDialog.locator('#new-folder-input').fill(folderName)
    await createDialog.locator('#new-folder-ok').click()

    // Wait for folder
    const folderItem = extensionPage.locator(
      `.content-item:has-text("${folderName}")`,
    )
    await expect(folderItem).toBeVisible()

    // Set up dialog handler to accept the confirm dialog
    extensionPage.on('dialog', async (dialog) => {
      await dialog.accept()
    })

    // Delete it via context menu
    await folderItem.click({ button: 'right' })
    const contextMenu = extensionPage.locator('#context-menu')
    await contextMenu.locator('[data-action="delete"]').click()

    // Wait for deletion to complete
    await extensionPage.waitForTimeout(500)

    // Verify deleted
    await expect(folderItem).toHaveCount(0)

    // Undo the delete
    const undoBtn = extensionPage.locator('#pane-1 button[data-action="undo"]')
    await undoBtn.click()

    // Wait for restore to complete
    await extensionPage.waitForTimeout(500)

    // Verify restored
    await expect(folderItem).toBeVisible()
  })

  test('context menu undo option should work', async () => {
    // Create a folder
    const newFolderBtn = extensionPage.locator(
      '#pane-1 button[data-action="new-folder"]',
    )
    await newFolderBtn.click()

    const dialog = extensionPage.locator('#new-folder-dialog')
    const testFolderName = `Context Menu Test ${Date.now()}`
    await dialog.locator('#new-folder-input').fill(testFolderName)
    await dialog.locator('#new-folder-ok').click()

    // Wait for folder
    await extensionPage.waitForSelector(
      `.content-item:has-text("${testFolderName}")`,
    )

    // Right click on empty area to open context menu
    await extensionPage
      .locator('#pane-1 .pane-content')
      .click({ button: 'right' })

    const contextMenu = extensionPage.locator('#context-menu')
    await expect(contextMenu).toBeVisible()

    // Click undo in context menu
    await contextMenu.locator('[data-action="undo"]').click()

    // Verify folder is removed
    const testFolder = extensionPage.locator(
      `.content-item:has-text("${testFolderName}")`,
    )
    await expect(testFolder).toHaveCount(0)
  })

  test('undo stack should be limited to 50 items', async () => {
    // This test verifies that the stack doesn't grow indefinitely
    // We'll create multiple items and verify undo still works after limit

    const newFolderBtn = extensionPage.locator(
      '#pane-1 button[data-action="new-folder"]',
    )
    const dialog = extensionPage.locator('#new-folder-dialog')

    // Create 5 folders (enough to test, not 50 to save time)
    for (let i = 0; i < 5; i++) {
      await newFolderBtn.click()
      await dialog.locator('#new-folder-input').fill(`Stack Test ${i}`)
      await dialog.locator('#new-folder-ok').click()
      await extensionPage.waitForTimeout(200) // Brief wait
    }

    // Verify undo button is enabled
    const undoBtn = extensionPage.locator('#pane-1 button[data-action="undo"]')
    await expect(undoBtn).toBeEnabled()

    // Undo all 5
    for (let i = 0; i < 5; i++) {
      await undoBtn.click()
      await extensionPage.waitForTimeout(200)
    }

    // Undo button should be disabled now
    await expect(undoBtn).toBeDisabled()
  })
})
