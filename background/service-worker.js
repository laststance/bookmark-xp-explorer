/**
 * Bookmark XP Explorer - Service Worker
 * Background script for Chrome extension
 */

// Extension installed
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Bookmark XP Explorer installed:', details.reason);
  
  if (details.reason === 'install') {
    console.log('Welcome to Bookmark XP Explorer!');
    // Open full page on first install
    chrome.tabs.create({ url: chrome.runtime.getURL('fullpage/fullpage.html') });
  }
});

// Keyboard shortcut handler
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-fullpage') {
    chrome.tabs.create({ url: chrome.runtime.getURL('fullpage/fullpage.html') });
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openFullPage') {
    chrome.tabs.create({ url: chrome.runtime.getURL('fullpage/fullpage.html') });
    sendResponse({ success: true });
  }
  return true;
});

// Listen for bookmark changes to potentially notify popup
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
