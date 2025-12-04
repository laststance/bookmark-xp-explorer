/**
 * Bookmark XP Explorer
 * Windows XP Style Bookmark Manager with Liquid Glass Theme
 */

// ============================================
// State Management
// ============================================
const state = {
  currentFolderId: '0',
  selectedItem: null,
  history: ['0'],
  historyIndex: 0,
  draggedItem: null,
  expandedFolders: new Set(['0', '1', '2']),
  searchMode: false,
  undoStack: [] // Array of undo actions, max 50 items
};

// Maximum undo history size
const MAX_UNDO_STACK_SIZE = 50;

// ============================================
// DOM Elements
// ============================================
const elements = {
  folderTree: document.getElementById('folder-tree'),
  contentView: document.getElementById('content-view'),
  currentPath: document.getElementById('current-path'),
  statusText: document.getElementById('status-text'),
  itemCount: document.getElementById('item-count'),
  searchInput: document.getElementById('search-input'),
  contextMenu: document.getElementById('context-menu'),
  
  // Dialogs
  renameDialog: document.getElementById('rename-dialog'),
  renameInput: document.getElementById('rename-input'),
  newFolderDialog: document.getElementById('new-folder-dialog'),
  newFolderInput: document.getElementById('new-folder-input'),
  newBookmarkDialog: document.getElementById('new-bookmark-dialog'),
  newBookmarkTitle: document.getElementById('new-bookmark-title'),
  newBookmarkUrl: document.getElementById('new-bookmark-url'),
  
  // Toolbar buttons
  btnBack: document.getElementById('btn-back'),
  btnForward: document.getElementById('btn-forward'),
  btnUp: document.getElementById('btn-up'),
  btnNewFolder: document.getElementById('btn-new-folder'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnUndo: document.getElementById('btn-undo')
};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadFolderTree();
  await navigateTo('1'); // Start at Bookmarks Bar
  setupEventListeners();
  setupDragAndDrop();
  setupContextMenu();
  setupDialogs();
  setupSearch();
}

// ============================================
// Folder Tree
// ============================================
async function loadFolderTree() {
  const tree = await chrome.bookmarks.getTree();
  elements.folderTree.innerHTML = '';
  
  // Render root folders
  tree[0].children.forEach(child => {
    renderTreeItem(child, elements.folderTree, 0);
  });
}

function renderTreeItem(node, container, depth) {
  if (node.url) return; // Skip bookmarks in tree
  
  const item = document.createElement('div');
  item.className = 'tree-item';
  item.dataset.id = node.id;
  item.style.paddingLeft = `${8 + depth * 16}px`;
  item.draggable = true;
  
  const hasChildren = node.children && node.children.some(c => !c.url);
  const isExpanded = state.expandedFolders.has(node.id);
  
  item.innerHTML = `
    <span class="tree-toggle ${hasChildren ? '' : 'empty'}">${isExpanded ? '−' : '+'}</span>
    <span class="tree-icon">${getFolderIcon(node.id)}</span>
    <span class="tree-label">${escapeHtml(node.title || 'Untitled')}</span>
  `;
  
  container.appendChild(item);
  
  // Children container
  if (hasChildren) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = `tree-children ${isExpanded ? 'expanded' : ''}`;
    childrenContainer.dataset.parentId = node.id;
    container.appendChild(childrenContainer);
    
    if (isExpanded && node.children) {
      node.children.forEach(child => {
        renderTreeItem(child, childrenContainer, depth + 1);
      });
    }
  }
}

function getFolderIcon(id) {
  switch(id) {
    case '1': return '⭐';  // Bookmarks Bar
    case '2': return '📁';  // Other Bookmarks
    case '3': return '📱';  // Mobile Bookmarks
    default: return '📁';
  }
}

// ============================================
// Content View
// ============================================
async function loadContent(folderId) {
  const children = await chrome.bookmarks.getChildren(folderId);
  elements.contentView.innerHTML = '';
  elements.contentView.classList.remove('search-results');
  
  if (children.length === 0) {
    elements.contentView.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📂</div>
        <div class="empty-state-text">This folder is empty</div>
      </div>
    `;
    elements.itemCount.textContent = '0 items';
    return;
  }
  
  // Keep original order from Chrome (no sorting)
  // This preserves the user's custom arrangement in the bookmark bar

  children.forEach(child => {
    renderContentItem(child);
  });
  
  elements.itemCount.textContent = `${children.length} item${children.length !== 1 ? 's' : ''}`;
}

function renderContentItem(node) {
  const item = document.createElement('div');
  item.className = 'content-item';
  item.dataset.id = node.id;
  item.dataset.url = node.url || '';
  item.dataset.isFolder = node.url ? 'false' : 'true';
  item.draggable = true;
  
  if (node.url) {
    // Bookmark
    const favicon = getFaviconUrl(node.url);
    item.innerHTML = `
      <div class="content-item-favicon">
        <img src="${favicon}" onerror="this.parentElement.innerHTML='🔗'">
      </div>
      <div class="content-item-label">${escapeHtml(node.title || 'Untitled')}</div>
    `;
  } else {
    // Folder
    item.innerHTML = `
      <div class="content-item-icon">📁</div>
      <div class="content-item-label">${escapeHtml(node.title || 'Untitled')}</div>
    `;
  }
  
  elements.contentView.appendChild(item);
}

function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch {
    return '';
  }
}

// ============================================
// Navigation
// ============================================
async function navigateTo(folderId, addToHistory = true) {
  state.currentFolderId = folderId;
  state.selectedItem = null;
  state.searchMode = false;
  elements.searchInput.value = '';
  
  // Update history
  if (addToHistory) {
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(folderId);
    state.historyIndex = state.history.length - 1;
  }
  
  // Update tree selection
  document.querySelectorAll('.tree-item.selected').forEach(el => el.classList.remove('selected'));
  const treeItem = elements.folderTree.querySelector(`.tree-item[data-id="${folderId}"]`);
  if (treeItem) {
    treeItem.classList.add('selected');
  }
  
  // Update path
  await updatePath(folderId);
  
  // Load content
  await loadContent(folderId);
  
  // Update status
  elements.statusText.textContent = 'Ready';
  updateNavButtons();
}

async function updatePath(folderId) {
  const pathParts = [];
  let currentId = folderId;
  
  while (currentId !== '0') {
    const nodes = await chrome.bookmarks.get(currentId);
    if (nodes.length === 0) break;
    pathParts.unshift({ id: currentId, title: nodes[0].title || 'Bookmarks' });
    currentId = nodes[0].parentId;
  }
  
  pathParts.unshift({ id: '0', title: 'Bookmarks' });
  
  elements.currentPath.innerHTML = pathParts.map(part => 
    `<span class="path-segment" data-id="${part.id}">${escapeHtml(part.title)}</span>`
  ).join('');
}

function updateNavButtons() {
  elements.btnBack.disabled = state.historyIndex <= 0;
  elements.btnForward.disabled = state.historyIndex >= state.history.length - 1;
  elements.btnUp.disabled = state.currentFolderId === '0';
}

async function goBack() {
  if (state.historyIndex > 0) {
    state.historyIndex--;
    await navigateTo(state.history[state.historyIndex], false);
  }
}

async function goForward() {
  if (state.historyIndex < state.history.length - 1) {
    state.historyIndex++;
    await navigateTo(state.history[state.historyIndex], false);
  }
}

async function goUp() {
  if (state.currentFolderId === '0') return;
  const nodes = await chrome.bookmarks.get(state.currentFolderId);
  if (nodes.length > 0 && nodes[0].parentId) {
    await navigateTo(nodes[0].parentId);
  }
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
  // Open Full Page button
  document.getElementById('open-fullpage').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('fullpage/fullpage.html') });
    window.close();
  });
  
  // Toolbar buttons
  elements.btnBack.addEventListener('click', goBack);
  elements.btnForward.addEventListener('click', goForward);
  elements.btnUp.addEventListener('click', goUp);
  elements.btnNewFolder.addEventListener('click', () => showNewFolderDialog());
  elements.btnRefresh.addEventListener('click', refresh);
  elements.btnUndo.addEventListener('click', performUndo);
  
  // Folder tree clicks
  elements.folderTree.addEventListener('click', async (e) => {
    const item = e.target.closest('.tree-item');
    if (!item) return;
    
    const toggle = e.target.closest('.tree-toggle');
    if (toggle && !toggle.classList.contains('empty')) {
      await toggleFolder(item.dataset.id);
    } else {
      await navigateTo(item.dataset.id);
    }
  });
  
  // Content view clicks
  elements.contentView.addEventListener('click', (e) => {
    const item = e.target.closest('.content-item');
    if (item) {
      selectItem(item);
    } else {
      clearSelection();
    }
  });
  
  // Double click
  elements.contentView.addEventListener('dblclick', async (e) => {
    const item = e.target.closest('.content-item');
    if (!item) return;
    
    if (item.dataset.isFolder === 'true') {
      await navigateTo(item.dataset.id);
    } else if (item.dataset.url) {
      chrome.tabs.create({ url: item.dataset.url });
    }
  });
  
  // Path navigation
  elements.currentPath.addEventListener('click', (e) => {
    const segment = e.target.closest('.path-segment');
    if (segment && segment !== elements.currentPath.lastElementChild) {
      navigateTo(segment.dataset.id);
    }
  });
  
  // Keyboard navigation
  document.addEventListener('keydown', handleKeyboard);
}

function handleKeyboard(e) {
  // Ctrl+Z / Cmd+Z - Undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    performUndo();
    return;
  }

  // Delete key
  if (e.key === 'Delete' && state.selectedItem) {
    deleteItem(state.selectedItem);
  }

  // F2 for rename
  if (e.key === 'F2' && state.selectedItem) {
    showRenameDialog(state.selectedItem);
  }

  // Backspace to go up
  if (e.key === 'Backspace' && !e.target.matches('input')) {
    e.preventDefault();
    goUp();
  }

  // Escape to close menus
  if (e.key === 'Escape') {
    hideContextMenu();
    hideAllDialogs();
  }
}

// ============================================
// Selection
// ============================================
function selectItem(item) {
  clearSelection();
  item.classList.add('selected');
  state.selectedItem = item.dataset.id;
}

function clearSelection() {
  document.querySelectorAll('.content-item.selected').forEach(el => el.classList.remove('selected'));
  state.selectedItem = null;
}

// ============================================
// Drag and Drop
// ============================================
function setupDragAndDrop() {
  // Drag start
  document.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.content-item, .tree-item');
    if (!item) return;
    
    state.draggedItem = item.dataset.id;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.id);
  });
  
  // Drag end
  document.addEventListener('dragend', (e) => {
    document.querySelectorAll('.dragging, .drag-over').forEach(el => {
      el.classList.remove('dragging', 'drag-over');
    });
    state.draggedItem = null;
  });
  
  // Drag over
  document.addEventListener('dragover', (e) => {
    const target = e.target.closest('.content-item[data-is-folder="true"], .tree-item');
    if (target && target.dataset.id !== state.draggedItem) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      // Clear previous drag-over states
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      target.classList.add('drag-over');
    }
  });
  
  // Drag leave
  document.addEventListener('dragleave', (e) => {
    const target = e.target.closest('.content-item, .tree-item');
    if (target) {
      target.classList.remove('drag-over');
    }
  });
  
  // Drop
  document.addEventListener('drop', async (e) => {
    e.preventDefault();

    const target = e.target.closest('.content-item[data-is-folder="true"], .tree-item');
    if (!target || !state.draggedItem) return;

    const targetId = target.dataset.id;
    if (targetId === state.draggedItem) return;

    try {
      // Capture original position before move for undo
      const [originalNode] = await chrome.bookmarks.get(state.draggedItem);
      const originalParentId = originalNode.parentId;
      const originalIndex = originalNode.index;

      await chrome.bookmarks.move(state.draggedItem, { parentId: targetId });

      // Push undo action
      pushUndoAction({
        type: 'move',
        itemId: state.draggedItem,
        originalParentId: originalParentId,
        originalIndex: originalIndex
      });

      elements.statusText.textContent = 'Item moved successfully';
      await refresh();
    } catch (error) {
      elements.statusText.textContent = 'Failed to move item';
      console.error('Move failed:', error);
    }

    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    state.draggedItem = null;
  });
}

// ============================================
// Context Menu
// ============================================
function setupContextMenu() {
  // Show context menu
  document.addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.content-item');
    if (item) {
      e.preventDefault();
      selectItem(item);
      showContextMenu(e.clientX, e.clientY, item);
    } else if (e.target.closest('.content-view')) {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, null);
    }
  });
  
  // Context menu actions
  elements.contextMenu.addEventListener('click', async (e) => {
    const menuItem = e.target.closest('.context-menu-item');
    if (!menuItem || menuItem.classList.contains('disabled')) return;

    const action = menuItem.dataset.action;
    const targetId = elements.contextMenu.dataset.targetId;

    hideContextMenu();

    switch (action) {
      case 'undo':
        await performUndo();
        break;

      case 'open':
        if (targetId) {
          const item = document.querySelector(`.content-item[data-id="${targetId}"]`);
          if (item.dataset.isFolder === 'true') {
            await navigateTo(targetId);
          } else if (item.dataset.url) {
            chrome.tabs.update({ url: item.dataset.url });
          }
        }
        break;

      case 'open-new-tab':
        if (targetId) {
          const item = document.querySelector(`.content-item[data-id="${targetId}"]`);
          if (item.dataset.url) {
            chrome.tabs.create({ url: item.dataset.url });
          }
        }
        break;

      case 'rename':
        if (targetId) showRenameDialog(targetId);
        break;

      case 'delete':
        if (targetId) deleteItem(targetId);
        break;

      case 'new-folder':
        showNewFolderDialog();
        break;

      case 'new-bookmark':
        showNewBookmarkDialog();
        break;
    }
  });
  
  // Hide on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu')) {
      hideContextMenu();
    }
  });
}

function showContextMenu(x, y, targetItem) {
  const menu = elements.contextMenu;
  menu.dataset.targetId = targetItem ? targetItem.dataset.id : '';
  
  // Show/hide relevant items
  const openItems = menu.querySelectorAll('[data-action="open"], [data-action="open-new-tab"]');
  const itemActions = menu.querySelectorAll('[data-action="rename"], [data-action="delete"]');
  
  if (targetItem) {
    openItems.forEach(el => el.style.display = '');
    itemActions.forEach(el => el.style.display = '');
    
    // Hide "Open in New Tab" for folders
    if (targetItem.dataset.isFolder === 'true') {
      menu.querySelector('[data-action="open-new-tab"]').style.display = 'none';
    }
  } else {
    openItems.forEach(el => el.style.display = 'none');
    itemActions.forEach(el => el.style.display = 'none');
  }
  
  // Position menu
  menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 250)}px`;
  menu.classList.add('visible');
}

function hideContextMenu() {
  elements.contextMenu.classList.remove('visible');
}

// ============================================
// Dialogs
// ============================================
function setupDialogs() {
  // Rename dialog
  document.getElementById('rename-ok').addEventListener('click', confirmRename);
  document.getElementById('rename-cancel').addEventListener('click', () => hideDialog(elements.renameDialog));
  elements.renameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmRename();
    if (e.key === 'Escape') hideDialog(elements.renameDialog);
  });
  
  // New folder dialog
  document.getElementById('new-folder-ok').addEventListener('click', confirmNewFolder);
  document.getElementById('new-folder-cancel').addEventListener('click', () => hideDialog(elements.newFolderDialog));
  elements.newFolderInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmNewFolder();
    if (e.key === 'Escape') hideDialog(elements.newFolderDialog);
  });
  
  // New bookmark dialog
  document.getElementById('new-bookmark-ok').addEventListener('click', confirmNewBookmark);
  document.getElementById('new-bookmark-cancel').addEventListener('click', () => hideDialog(elements.newBookmarkDialog));
  elements.newBookmarkUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmNewBookmark();
    if (e.key === 'Escape') hideDialog(elements.newBookmarkDialog);
  });
  
  // Close on overlay click
  document.querySelectorAll('.dialog-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideDialog(overlay);
    });
  });
}

function showDialog(dialog) {
  dialog.classList.add('visible');
  const input = dialog.querySelector('input');
  if (input) {
    input.focus();
    input.select();
  }
}

function hideDialog(dialog) {
  dialog.classList.remove('visible');
}

function hideAllDialogs() {
  document.querySelectorAll('.dialog-overlay').forEach(d => d.classList.remove('visible'));
}

// Rename
async function showRenameDialog(id) {
  const nodes = await chrome.bookmarks.get(id);
  if (nodes.length === 0) return;
  
  elements.renameInput.value = nodes[0].title;
  elements.renameDialog.dataset.targetId = id;
  showDialog(elements.renameDialog);
}

async function confirmRename() {
  const id = elements.renameDialog.dataset.targetId;
  const newTitle = elements.renameInput.value.trim();

  if (!newTitle) return;

  try {
    // Capture original title before rename for undo
    const [node] = await chrome.bookmarks.get(id);
    const originalTitle = node.title;

    // Skip if title unchanged
    if (originalTitle === newTitle) {
      hideDialog(elements.renameDialog);
      return;
    }

    await chrome.bookmarks.update(id, { title: newTitle });

    // Push undo action
    pushUndoAction({
      type: 'rename',
      itemId: id,
      originalTitle: originalTitle
    });

    elements.statusText.textContent = 'Renamed successfully';
    await refresh();
  } catch (error) {
    elements.statusText.textContent = 'Failed to rename';
  }

  hideDialog(elements.renameDialog);
}

// New folder
function showNewFolderDialog() {
  elements.newFolderInput.value = 'New Folder';
  showDialog(elements.newFolderDialog);
}

async function confirmNewFolder() {
  const title = elements.newFolderInput.value.trim();
  if (!title) return;

  try {
    const created = await chrome.bookmarks.create({
      parentId: state.currentFolderId,
      title: title
    });

    // Push undo action
    pushUndoAction({
      type: 'create',
      createdId: created.id
    });

    elements.statusText.textContent = 'Folder created';
    await refresh();
  } catch (error) {
    elements.statusText.textContent = 'Failed to create folder';
  }

  hideDialog(elements.newFolderDialog);
}

// New bookmark
function showNewBookmarkDialog() {
  elements.newBookmarkTitle.value = '';
  elements.newBookmarkUrl.value = '';
  showDialog(elements.newBookmarkDialog);
}

async function confirmNewBookmark() {
  const title = elements.newBookmarkTitle.value.trim();
  const url = elements.newBookmarkUrl.value.trim();

  if (!title || !url) return;

  try {
    const created = await chrome.bookmarks.create({
      parentId: state.currentFolderId,
      title: title,
      url: url
    });

    // Push undo action
    pushUndoAction({
      type: 'create',
      createdId: created.id
    });

    elements.statusText.textContent = 'Bookmark created';
    await refresh();
  } catch (error) {
    elements.statusText.textContent = 'Failed to create bookmark';
  }

  hideDialog(elements.newBookmarkDialog);
}

// Delete
async function deleteItem(id) {
  const nodes = await chrome.bookmarks.get(id);
  if (nodes.length === 0) return;

  const node = nodes[0];
  const isFolder = !node.url;
  const message = isFolder
    ? `Delete folder "${node.title}" and all its contents?`
    : `Delete bookmark "${node.title}"?`;

  if (!confirm(message)) return;

  try {
    // Capture full data before deletion for undo
    const fullData = await captureBookmarkTree(id);
    const parentId = node.parentId;
    const index = node.index;

    if (isFolder) {
      await chrome.bookmarks.removeTree(id);
    } else {
      await chrome.bookmarks.remove(id);
    }

    // Push undo action
    pushUndoAction({
      type: 'delete',
      data: fullData,
      parentId: parentId,
      index: index
    });

    elements.statusText.textContent = 'Deleted successfully';
    state.selectedItem = null;
    await refresh();
  } catch (error) {
    elements.statusText.textContent = 'Failed to delete';
  }
}

// ============================================
// Search
// ============================================
function setupSearch() {
  let searchTimeout;
  
  elements.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < 2) {
      if (state.searchMode) {
        navigateTo(state.currentFolderId, false);
      }
      return;
    }
    
    searchTimeout = setTimeout(() => performSearch(query), 300);
  });
}

async function performSearch(query) {
  state.searchMode = true;
  elements.contentView.innerHTML = '';
  elements.contentView.classList.add('search-results');
  
  const results = await chrome.bookmarks.search(query);
  
  if (results.length === 0) {
    elements.contentView.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-text">No results found for "${escapeHtml(query)}"</div>
      </div>
    `;
    elements.itemCount.textContent = '0 results';
    return;
  }
  
  results.forEach(node => {
    const item = document.createElement('div');
    item.className = 'content-item';
    item.dataset.id = node.id;
    item.dataset.url = node.url || '';
    item.dataset.isFolder = node.url ? 'false' : 'true';
    item.draggable = true;
    
    if (node.url) {
      const favicon = getFaviconUrl(node.url);
      item.innerHTML = `
        <div class="content-item-favicon">
          <img src="${favicon}" onerror="this.parentElement.innerHTML='🔗'">
        </div>
        <div class="content-item-label">${escapeHtml(node.title || 'Untitled')}</div>
        <div class="content-item-url">${escapeHtml(node.url)}</div>
      `;
    } else {
      item.innerHTML = `
        <div class="content-item-icon">📁</div>
        <div class="content-item-label">${escapeHtml(node.title || 'Untitled')}</div>
      `;
    }
    
    elements.contentView.appendChild(item);
  });
  
  elements.itemCount.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
  elements.statusText.textContent = `Search results for "${query}"`;
}

// ============================================
// Tree Toggle
// ============================================
async function toggleFolder(folderId) {
  const isExpanded = state.expandedFolders.has(folderId);
  
  if (isExpanded) {
    state.expandedFolders.delete(folderId);
  } else {
    state.expandedFolders.add(folderId);
  }
  
  await loadFolderTree();
  
  // Restore selection
  const treeItem = elements.folderTree.querySelector(`.tree-item[data-id="${state.currentFolderId}"]`);
  if (treeItem) {
    treeItem.classList.add('selected');
  }
}

// ============================================
// Refresh
// ============================================
async function refresh() {
  await loadFolderTree();
  await loadContent(state.currentFolderId);
  
  // Restore tree selection
  const treeItem = elements.folderTree.querySelector(`.tree-item[data-id="${state.currentFolderId}"]`);
  if (treeItem) {
    treeItem.classList.add('selected');
  }
}

// ============================================
// Undo System
// ============================================

/**
 * Captures the full bookmark tree recursively for undo restore.
 * @param {string} id - Bookmark/folder ID
 * @returns {Promise<Object>} Full bookmark tree data
 */
async function captureBookmarkTree(id) {
  const [subtree] = await chrome.bookmarks.getSubTree(id);
  return subtree;
}

/**
 * Restores a bookmark tree recursively.
 * @param {Object} node - Bookmark tree node to restore
 * @param {string} parentId - Parent folder ID
 * @param {number} index - Position index
 * @returns {Promise<Object>} Created bookmark
 */
async function restoreBookmarkTree(node, parentId, index) {
  const createData = {
    parentId,
    title: node.title,
    index
  };

  // Only add URL for bookmarks (not folders)
  if (node.url) {
    createData.url = node.url;
  }

  const created = await chrome.bookmarks.create(createData);

  // If folder with children, restore children recursively
  if (node.children && node.children.length > 0) {
    for (let i = 0; i < node.children.length; i++) {
      await restoreBookmarkTree(node.children[i], created.id, i);
    }
  }

  return created;
}

/**
 * Pushes an undo action to the stack.
 * @param {Object} action - Undo action data
 */
function pushUndoAction(action) {
  state.undoStack.push({
    ...action,
    timestamp: Date.now()
  });

  // Limit stack size
  if (state.undoStack.length > MAX_UNDO_STACK_SIZE) {
    state.undoStack.shift();
  }

  updateUndoButton();
}

/**
 * Updates the disabled state of the undo button.
 */
function updateUndoButton() {
  const hasUndoActions = state.undoStack.length > 0;
  elements.btnUndo.disabled = !hasUndoActions;

  // Also update context menu undo item if visible
  const undoMenuItem = elements.contextMenu.querySelector('[data-action="undo"]');
  if (undoMenuItem) {
    undoMenuItem.classList.toggle('disabled', !hasUndoActions);
  }
}

/**
 * Performs the undo operation for the most recent action.
 */
async function performUndo() {
  if (state.undoStack.length === 0) {
    elements.statusText.textContent = 'Nothing to undo';
    return;
  }

  const action = state.undoStack.pop();
  updateUndoButton();

  try {
    switch (action.type) {
      case 'delete':
        // Restore deleted bookmark/folder
        await restoreBookmarkTree(action.data, action.parentId, action.index);
        elements.statusText.textContent = `Restored "${action.data.title}"`;
        break;

      case 'move':
        // Move item back to original location
        await chrome.bookmarks.move(action.itemId, {
          parentId: action.originalParentId,
          index: action.originalIndex
        });
        elements.statusText.textContent = 'Move undone';
        break;

      case 'rename':
        // Restore original title
        await chrome.bookmarks.update(action.itemId, {
          title: action.originalTitle
        });
        elements.statusText.textContent = 'Rename undone';
        break;

      case 'create':
        // Delete the created item
        const [node] = await chrome.bookmarks.get(action.createdId);
        if (node) {
          if (node.url) {
            await chrome.bookmarks.remove(action.createdId);
          } else {
            await chrome.bookmarks.removeTree(action.createdId);
          }
        }
        elements.statusText.textContent = 'Creation undone';
        break;

      default:
        elements.statusText.textContent = 'Unknown action type';
        return;
    }

    // Refresh UI
    await refresh();

  } catch (error) {
    console.error('Undo failed:', error);
    elements.statusText.textContent = 'Undo failed';
  }
}

// ============================================
// Utilities
// ============================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
