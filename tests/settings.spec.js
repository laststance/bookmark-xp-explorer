/**
 * Playwright tests for Settings feature
 * Tests the view mode toggle and settings page functionality
 */
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const extensionPath = path.join(__dirname, '..');

test.describe('Settings Feature', () => {
  let context;
  let extensionId;

  test.beforeAll(async () => {
    // Launch browser with extension
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
      ],
    });

    // Wait for extension to load and get its ID
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    extensionId = background.url().split('/')[2];
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('settings page should load correctly', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/settings/settings.html`);

    // Verify page title
    await expect(page.locator('h1')).toContainText('Settings');

    // Verify toggle container is visible (the input is hidden, but toggle-switch is visible)
    const toggleSwitch = page.locator('.toggle-switch');
    await expect(toggleSwitch).toBeVisible();

    // Verify input is checked by default (fullpage mode)
    const toggleInput = page.locator('#fullpage-default');
    await expect(toggleInput).toBeChecked();

    // Verify version is displayed
    await expect(page.locator('#version')).toContainText('1.1.0');

    await page.close();
  });

  test('toggle should persist preference to storage', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/settings/settings.html`);

    const toggleInput = page.locator('#fullpage-default');
    const toggleContainer = page.locator('.toggle-container');

    // Initially checked (fullpage mode)
    await expect(toggleInput).toBeChecked();

    // Click the label/container to toggle (since input is hidden)
    await toggleContainer.click();
    await expect(toggleInput).not.toBeChecked();

    // Reload page and verify persistence
    await page.reload();
    const toggleAfterReload = page.locator('#fullpage-default');
    await expect(toggleAfterReload).not.toBeChecked();

    // Toggle back on for other tests
    await page.locator('.toggle-container').click();
    await expect(toggleAfterReload).toBeChecked();

    await page.close();
  });

  test('popup should have settings button', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

    // Verify settings button exists
    const settingsBtn = page.locator('#open-settings');
    await expect(settingsBtn).toBeVisible();
    await expect(settingsBtn).toHaveAttribute('title', 'Settings');

    await page.close();
  });

  test('fullpage should have settings button', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/fullpage/fullpage.html`);

    // Verify settings button exists
    const settingsBtn = page.locator('#open-settings');
    await expect(settingsBtn).toBeVisible();
    await expect(settingsBtn).toHaveAttribute('title', 'Settings');

    await page.close();
  });

  test('settings button in popup should open settings page', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

    // Click settings button
    const settingsBtn = page.locator('#open-settings');

    // Listen for new page
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      settingsBtn.click(),
    ]);

    // Verify new page is settings
    await expect(newPage).toHaveURL(new RegExp('settings/settings.html'));
    await expect(newPage.locator('h1')).toContainText('Settings');

    await newPage.close();
    await page.close();
  });

  test('settings button in fullpage should open settings page', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/fullpage/fullpage.html`);

    // Click settings button
    const settingsBtn = page.locator('#open-settings');

    // Listen for new page
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      settingsBtn.click(),
    ]);

    // Verify new page is settings
    await expect(newPage).toHaveURL(new RegExp('settings/settings.html'));
    await expect(newPage.locator('h1')).toContainText('Settings');

    await newPage.close();
    await page.close();
  });

  test('keyboard shortcuts section should display correctly', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/settings/settings.html`);

    // Verify keyboard shortcuts section exists
    await expect(page.locator('text=Keyboard Shortcuts')).toBeVisible();
    // Verify kbd elements exist
    await expect(page.locator('kbd').first()).toBeVisible();
    await expect(page.locator('.shortcut-list')).toBeVisible();

    await page.close();
  });
});
