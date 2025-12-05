/**
 * Bookmark XP Explorer - Full Page Mode
 * XP Style + Liquid Glass Theme
 * Split View Support
 */

// ============================================
// State Management
// ============================================
const state = {
  panes: {
    1: {
      currentFolderId: '1',
      history: ['1'],
      historyIndex: 0,
      selectedItems: new Set(),
    },
    2: {
      currentFolderId: '2',
      history: ['2'],
      historyIndex: 0,
      selectedItems: new Set(),
    },
  },
  activePane: 1,
  viewMode: 'single', // 'single' or 'split'
  expandedFolders: new Set(['0', '1', '2']),
  draggedItem: null,
  clipboard: null, // { action: 'cut'|'copy', id: string, sourcePane: number }
  sidebarWidth: 260,
  undoStack: [], // Array of undo actions, max 50 items
}

// Maximum undo history size
const MAX_UNDO_STACK_SIZE = 50

// ============================================
// DOM Elements
// ============================================
const elements = {
  folderTree: document.getElementById('folder-tree'),
  contentArea: document.getElementById('content-area'),
  contextMenu: document.getElementById('context-menu'),
  toastContainer: document.getElementById('toast-container'),
  sidebarResizer: document.getElementById('sidebar-resizer'),
  paneSplitter: document.getElementById('pane-splitter'),
  sidebar: document.querySelector('.sidebar'),
}

// ============================================
// Theme Management
// ============================================

/**
 * Storage key for the theme preference
 * @type {string}
 */
const THEME_STORAGE_KEY = 'theme'

/**
 * Applies the theme to the document.
 * Defaults to 'light' theme.
 * @returns {Promise<void>}
 */
async function loadTheme() {
  try {
    const result = await chrome.storage.local.get([THEME_STORAGE_KEY])
    const theme = result[THEME_STORAGE_KEY] || 'light' // Default to light

    if (theme === 'system') {
      // Remove data-theme to let CSS media query handle it
      document.documentElement.removeAttribute('data-theme')
    } else {
      // Apply explicit theme
      document.documentElement.setAttribute('data-theme', theme)
    }
  } catch (error) {
    console.error('Failed to load theme:', error)
    // Default to light theme on error
    document.documentElement.setAttribute('data-theme', 'light')
  }
}

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', init)

async function init() {
  // Load theme first to prevent flash
  await loadTheme()

  // Load saved state
  await loadState()

  // Initialize UI
  await loadFolderTree()
  await loadPaneContent(1)
  await loadPaneContent(2)

  // Setup event listeners
  setupViewModeSwitcher()
  setupPaneNavigation()
  setupSidebarEvents()
  setupDragAndDrop()
  setupContextMenu()
  setupDialogs()
  setupSearch()
  setupKeyboardShortcuts()
  setupResizers()
  setupSettingsButton()

  // Set initial view mode
  if (state.viewMode === 'split') {
    elements.contentArea.classList.add('split-view')
    document.querySelector('[data-mode="split"]').classList.add('active')
    document.querySelector('[data-mode="single"]').classList.remove('active')
  }

  // Focus first pane
  setActivePane(1)
}

// ============================================
// State Persistence
// ============================================
async function loadState() {
  try {
    const saved = await chrome.storage.local.get(['bookmarkExplorerState'])
    if (saved.bookmarkExplorerState) {
      const s = saved.bookmarkExplorerState
      state.viewMode = s.viewMode || 'single'
      state.sidebarWidth = s.sidebarWidth || 260
      if (s.expandedFolders) {
        state.expandedFolders = new Set(s.expandedFolders)
      }
    }
  } catch (e) {
    console.log('Could not load state:', e)
  }
}

async function saveState() {
  try {
    await chrome.storage.local.set({
      bookmarkExplorerState: {
        viewMode: state.viewMode,
        sidebarWidth: state.sidebarWidth,
        expandedFolders: Array.from(state.expandedFolders),
      },
    })
  } catch (e) {
    console.log('Could not save state:', e)
  }
}

// ============================================
// View Mode Switcher
// ============================================
function setupViewModeSwitcher() {
  document.querySelectorAll('.view-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode
      setViewMode(mode)
    })
  })
}

function setViewMode(mode) {
  state.viewMode = mode

  document.querySelectorAll('.view-mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode)
  })

  elements.contentArea.classList.toggle('split-view', mode === 'split')

  saveState()

  if (mode === 'split') {
    showToast('Split view enabled - drag items between panes!', 'info')
  }
}

/**
 * Sets up the settings button click handler.
 * Opens the settings page in a new tab.
 */
function setupSettingsButton() {
  document.getElementById('open-settings').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') })
  })
}

// ============================================
// Folder Tree
// ============================================
async function loadFolderTree() {
  const tree = await chrome.bookmarks.getTree()
  elements.folderTree.innerHTML = ''

  tree[0].children.forEach((child) => {
    renderTreeItem(child, elements.folderTree, 0)
  })
}

function renderTreeItem(node, container, depth) {
  if (node.url) return

  const item = document.createElement('div')
  item.className = 'tree-item'
  item.dataset.id = node.id
  item.style.paddingLeft = `${12 + depth * 18}px`
  item.draggable = true

  const hasChildren = node.children && node.children.some((c) => !c.url)
  const isExpanded = state.expandedFolders.has(node.id)

  item.innerHTML = `
    <span class="tree-toggle ${hasChildren ? '' : 'empty'}">${isExpanded ? '−' : '+'}</span>
    <span class="tree-icon">${getFolderIcon(node.id)}</span>
    <span class="tree-label">${escapeHtml(node.title || 'Untitled')}</span>
  `

  container.appendChild(item)

  if (hasChildren) {
    const childrenContainer = document.createElement('div')
    childrenContainer.className = `tree-children ${isExpanded ? 'expanded' : ''}`
    childrenContainer.dataset.parentId = node.id
    container.appendChild(childrenContainer)

    if (isExpanded && node.children) {
      node.children.forEach((child) => {
        renderTreeItem(child, childrenContainer, depth + 1)
      })
    }
  }
}

function getFolderIcon(id) {
  switch (id) {
    case '1':
      return '⭐'
    case '2':
      return '📁'
    case '3':
      return '📱'
    default:
      return '📁'
  }
}

// ============================================
// Pane Content
// ============================================
async function loadPaneContent(paneNum) {
  const paneState = state.panes[paneNum]
  const content = document.querySelector(
    `.pane-content[data-pane="${paneNum}"]`,
  )
  const children = await chrome.bookmarks.getChildren(paneState.currentFolderId)

  content.innerHTML = ''

  if (children.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📂</div>
        <div class="empty-state-text">This folder is empty</div>
      </div>
    `
    updatePaneStatus(paneNum, 0)
    return
  }

  // Keep original order from Chrome (no sorting)
  // This preserves the user's custom arrangement in the bookmark bar

  children.forEach((child) => {
    renderContentItem(child, content)
  })

  updatePaneStatus(paneNum, children.length)
  await updatePanePath(paneNum)
  updatePaneNavButtons(paneNum)
}

function renderContentItem(node, container) {
  const item = document.createElement('div')
  item.className = 'content-item'
  item.dataset.id = node.id
  item.dataset.url = node.url || ''
  item.dataset.isFolder = node.url ? 'false' : 'true'
  item.dataset.title = node.title || 'Untitled'
  item.draggable = true

  if (node.url) {
    const favicon = getFaviconUrl(node.url)
    item.innerHTML = `
      <div class="content-item-favicon">
        <img src="${favicon}" onerror="this.parentElement.innerHTML='🔗'">
      </div>
      <div class="content-item-label">${escapeHtml(node.title || 'Untitled')}</div>
    `
  } else {
    item.innerHTML = `
      <div class="content-item-icon">📁</div>
      <div class="content-item-label">${escapeHtml(node.title || 'Untitled')}</div>
    `
  }

  container.appendChild(item)
}

function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`
  } catch {
    return ''
  }
}

function updatePaneStatus(paneNum, count) {
  const statusText = document.querySelector(
    `.status-text[data-pane="${paneNum}"]`,
  )
  const itemCount = document.querySelector(
    `.item-count[data-pane="${paneNum}"]`,
  )

  statusText.textContent = 'Ready'
  itemCount.textContent = `${count} item${count !== 1 ? 's' : ''}`
}

async function updatePanePath(paneNum) {
  const paneState = state.panes[paneNum]
  const pathContainer = document.querySelector(
    `.address-path[data-pane="${paneNum}"]`,
  )
  const pathParts = []
  let currentId = paneState.currentFolderId

  while (currentId !== '0') {
    const nodes = await chrome.bookmarks.get(currentId)
    if (nodes.length === 0) break
    pathParts.unshift({ id: currentId, title: nodes[0].title || 'Bookmarks' })
    currentId = nodes[0].parentId
  }

  pathParts.unshift({ id: '0', title: 'Bookmarks' })

  pathContainer.innerHTML = pathParts
    .map(
      (part) =>
        `<span class="path-segment" data-id="${part.id}">${escapeHtml(part.title)}</span>`,
    )
    .join('')
}

function updatePaneNavButtons(paneNum) {
  const paneState = state.panes[paneNum]
  const pane = document.getElementById(`pane-${paneNum}`)

  const backBtn = pane.querySelector('[data-action="back"]')
  const forwardBtn = pane.querySelector('[data-action="forward"]')
  const upBtn = pane.querySelector('[data-action="up"]')

  backBtn.disabled = paneState.historyIndex <= 0
  forwardBtn.disabled = paneState.historyIndex >= paneState.history.length - 1
  upBtn.disabled = paneState.currentFolderId === '0'
}

// ============================================
// Pane Navigation
// ============================================
function setupPaneNavigation() {
  // Pane toolbar buttons
  document.querySelectorAll('.explorer-pane').forEach((pane) => {
    const paneNum = parseInt(pane.dataset.pane)

    pane.querySelectorAll('.pane-btn[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action
        handlePaneAction(paneNum, action)
      })
    })

    // Path navigation
    pane.querySelector('.address-path').addEventListener('click', (e) => {
      const segment = e.target.closest('.path-segment')
      if (
        segment &&
        segment !== pane.querySelector('.address-path').lastElementChild
      ) {
        navigatePane(paneNum, segment.dataset.id)
      }
    })

    // Pane click to activate
    pane.addEventListener('click', () => setActivePane(paneNum))

    // Content click handlers
    const content = pane.querySelector('.pane-content')

    content.addEventListener('click', (e) => {
      const item = e.target.closest('.content-item')
      if (item) {
        if (e.ctrlKey || e.metaKey) {
          // CMD+Click (Mac) or Ctrl+Click (Windows) opens bookmark in new tab
          if (item.dataset.url) {
            chrome.tabs.create({ url: item.dataset.url })
            return
          }
          // For folders, keep multi-select behavior
          toggleItemSelection(paneNum, item)
        } else {
          selectItem(paneNum, item)
        }
      } else {
        clearSelection(paneNum)
      }
    })

    content.addEventListener('dblclick', async (e) => {
      const item = e.target.closest('.content-item')
      if (!item) return

      if (item.dataset.isFolder === 'true') {
        await navigatePane(paneNum, item.dataset.id)
      } else if (item.dataset.url) {
        chrome.tabs.create({ url: item.dataset.url })
      }
    })
  })

  // Folder tree clicks
  elements.folderTree.addEventListener('click', async (e) => {
    const item = e.target.closest('.tree-item')
    if (!item) return

    const toggle = e.target.closest('.tree-toggle')
    if (toggle && !toggle.classList.contains('empty')) {
      await toggleFolder(item.dataset.id)
    } else {
      await navigatePane(state.activePane, item.dataset.id)
    }
  })
}

async function handlePaneAction(paneNum, action) {
  const paneState = state.panes[paneNum]

  switch (action) {
    case 'back':
      if (paneState.historyIndex > 0) {
        paneState.historyIndex--
        await navigatePane(
          paneNum,
          paneState.history[paneState.historyIndex],
          false,
        )
      }
      break

    case 'forward':
      if (paneState.historyIndex < paneState.history.length - 1) {
        paneState.historyIndex++
        await navigatePane(
          paneNum,
          paneState.history[paneState.historyIndex],
          false,
        )
      }
      break

    case 'up':
      if (paneState.currentFolderId !== '0') {
        const nodes = await chrome.bookmarks.get(paneState.currentFolderId)
        if (nodes.length > 0 && nodes[0].parentId) {
          await navigatePane(paneNum, nodes[0].parentId)
        }
      }
      break

    case 'refresh':
      await loadPaneContent(paneNum)
      showToast('Refreshed', 'success')
      break

    case 'undo':
      await performUndo()
      break

    case 'new-folder':
      showNewFolderDialog(paneNum)
      break

    case 'new-bookmark':
      showNewBookmarkDialog(paneNum)
      break
  }
}

async function navigatePane(paneNum, folderId, addToHistory = true) {
  const paneState = state.panes[paneNum]

  paneState.currentFolderId = folderId
  paneState.selectedItems.clear()

  // Clear search
  const searchInput = document.querySelector(
    `.search-input[data-pane="${paneNum}"]`,
  )
  if (searchInput) searchInput.value = ''

  if (addToHistory) {
    paneState.history = paneState.history.slice(0, paneState.historyIndex + 1)
    paneState.history.push(folderId)
    paneState.historyIndex = paneState.history.length - 1
  }

  // Update tree selection if this is active pane
  if (paneNum === state.activePane) {
    document
      .querySelectorAll('.tree-item.selected')
      .forEach((el) => el.classList.remove('selected'))
    const treeItem = elements.folderTree.querySelector(
      `.tree-item[data-id="${folderId}"]`,
    )
    if (treeItem) {
      treeItem.classList.add('selected')
    }
  }

  await loadPaneContent(paneNum)
}

function setActivePane(paneNum) {
  state.activePane = paneNum

  document.querySelectorAll('.explorer-pane').forEach((pane) => {
    pane.classList.toggle('active', parseInt(pane.dataset.pane) === paneNum)
  })

  // Update tree selection
  const currentFolderId = state.panes[paneNum].currentFolderId
  document
    .querySelectorAll('.tree-item.selected')
    .forEach((el) => el.classList.remove('selected'))
  const treeItem = elements.folderTree.querySelector(
    `.tree-item[data-id="${currentFolderId}"]`,
  )
  if (treeItem) {
    treeItem.classList.add('selected')
  }
}

// ============================================
// Selection
// ============================================
function selectItem(paneNum, item) {
  clearSelection(paneNum)
  item.classList.add('selected')
  state.panes[paneNum].selectedItems.add(item.dataset.id)
}

function toggleItemSelection(paneNum, item) {
  const itemId = item.dataset.id
  if (state.panes[paneNum].selectedItems.has(itemId)) {
    item.classList.remove('selected')
    state.panes[paneNum].selectedItems.delete(itemId)
  } else {
    item.classList.add('selected')
    state.panes[paneNum].selectedItems.add(itemId)
  }
}

function clearSelection(paneNum) {
  const content = document.querySelector(
    `.pane-content[data-pane="${paneNum}"]`,
  )
  content
    .querySelectorAll('.content-item.selected')
    .forEach((el) => el.classList.remove('selected'))
  state.panes[paneNum].selectedItems.clear()
}

// ============================================
// Sidebar Events
// ============================================
function setupSidebarEvents() {
  const toggleBtn = document.getElementById('toggle-sidebar')

  toggleBtn.addEventListener('click', () => {
    elements.sidebar.classList.toggle('collapsed')
  })
}

// ============================================
// Folder Toggle
// ============================================
async function toggleFolder(folderId) {
  const isExpanded = state.expandedFolders.has(folderId)

  if (isExpanded) {
    state.expandedFolders.delete(folderId)
  } else {
    state.expandedFolders.add(folderId)
  }

  await loadFolderTree()
  saveState()

  // Restore tree selection
  const currentFolderId = state.panes[state.activePane].currentFolderId
  const treeItem = elements.folderTree.querySelector(
    `.tree-item[data-id="${currentFolderId}"]`,
  )
  if (treeItem) {
    treeItem.classList.add('selected')
  }
}

// ============================================
// Drag and Drop
// ============================================
function setupDragAndDrop() {
  // Track last drop target and position to prevent flickering
  let lastDropTarget = null
  let lastDropPosition = null // 'before' | 'after' | 'into'

  /**
   * Find a valid drop target near the given coordinates
   * @param {number} x - Client X coordinate
   * @param {number} y - Client Y coordinate
   * @param {string} excludeId - ID to exclude (the dragged item)
   * @returns {Element|null} - Valid drop target or null
   */
  function findNearbyDropTarget(x, y, excludeId) {
    // Search offsets: center, then expanding circle
    const searchOffsets = [
      [0, 0],
      [0, -12],
      [0, 12],
      [-12, 0],
      [12, 0],
      [-12, -12],
      [12, -12],
      [-12, 12],
      [12, 12],
      [0, -24],
      [0, 24],
      [-24, 0],
      [24, 0],
      [-24, -24],
      [24, -24],
      [-24, 24],
      [24, 24],
    ]

    for (const [dx, dy] of searchOffsets) {
      const el = document.elementFromPoint(x + dx, y + dy)
      if (!el) continue

      // Now also include non-folder content items for reordering
      const target = el.closest('.content-item, .tree-item')
      if (target && target.dataset.id !== excludeId) {
        return target
      }
    }
    return null
  }

  /**
   * Determine drop position based on mouse position relative to target
   * @param {MouseEvent} e - Mouse event
   * @param {Element} target - Target element
   * @returns {'before' | 'after' | 'into'} - Drop position
   */
  function getDropPosition(e, target) {
    const rect = target.getBoundingClientRect()
    const mouseY = e.clientY
    const relativeY = mouseY - rect.top
    const heightRatio = relativeY / rect.height

    const isFolder = target.dataset.isFolder === 'true'

    if (isFolder) {
      // For folders: top 25% = before, middle 50% = into, bottom 25% = after
      if (heightRatio < 0.25) return 'before'
      if (heightRatio > 0.75) return 'after'
      return 'into'
    } else {
      // For bookmarks: top 50% = before, bottom 50% = after
      return heightRatio < 0.5 ? 'before' : 'after'
    }
  }

  /**
   * Update visual feedback classes based on drop position
   * @param {Element} target - Target element
   * @param {'before' | 'after' | 'into' | null} position - Drop position
   */
  function updateDropIndicator(target, position) {
    // Remove all drop indicators
    document
      .querySelectorAll('.drag-over, .drop-before, .drop-after')
      .forEach((el) => {
        el.classList.remove('drag-over', 'drop-before', 'drop-after')
      })

    if (!target || !position) return

    if (position === 'into') {
      target.classList.add('drag-over')
    } else if (position === 'before') {
      target.classList.add('drop-before')
    } else if (position === 'after') {
      target.classList.add('drop-after')
    }
  }

  document.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.content-item, .tree-item')
    if (!item) return

    state.draggedItem = {
      id: item.dataset.id,
      pane: item.closest('.explorer-pane')?.dataset.pane || null,
    }

    item.classList.add('dragging')
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.dataset.id)

    document.body.classList.add('dragging-active')
  })

  document.addEventListener('dragend', () => {
    document
      .querySelectorAll('.dragging, .drag-over, .drop-before, .drop-after')
      .forEach((el) => {
        el.classList.remove(
          'dragging',
          'drag-over',
          'drop-before',
          'drop-after',
        )
      })
    state.draggedItem = null
    lastDropTarget = null
    lastDropPosition = null
    document.body.classList.remove('dragging-active')
  })

  document.addEventListener('dragover', (e) => {
    if (!state.draggedItem) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    // Find valid drop target (now includes all content items)
    let target = e.target.closest('.content-item, .tree-item')

    // If not found directly, search nearby
    if (!target) {
      target = findNearbyDropTarget(e.clientX, e.clientY, state.draggedItem.id)
    }

    // Also allow pane-content as drop zone (move to current folder)
    const paneContent = !target ? e.target.closest('.pane-content') : null

    if (target && target.dataset?.id !== state.draggedItem.id) {
      const position = getDropPosition(e, target)

      // Only update if target or position changed
      if (lastDropTarget !== target || lastDropPosition !== position) {
        updateDropIndicator(target, position)
        lastDropTarget = target
        lastDropPosition = position
      }
    } else if (paneContent) {
      if (lastDropTarget !== paneContent) {
        updateDropIndicator(null, null)
        paneContent.classList.add('drag-over')
        lastDropTarget = paneContent
        lastDropPosition = 'into'
      }
    } else if (lastDropTarget) {
      updateDropIndicator(null, null)
      lastDropTarget = null
      lastDropPosition = null
    }
  })

  document.addEventListener('dragleave', (e) => {
    const target = e.target.closest('.content-item, .tree-item, .pane-content')
    if (!target) return

    const relatedTarget = e.relatedTarget
    if (relatedTarget && target.contains(relatedTarget)) {
      return
    }

    const newTarget = relatedTarget?.closest(
      '.content-item, .tree-item, .pane-content',
    )
    if (newTarget && newTarget !== target) {
      return
    }

    target.classList.remove('drag-over', 'drop-before', 'drop-after')
    if (lastDropTarget === target) {
      lastDropTarget = null
      lastDropPosition = null
    }
  })

  document.addEventListener('drop', async (e) => {
    e.preventDefault()

    if (!state.draggedItem) return

    // CRITICAL: Capture state immediately to prevent race condition
    const draggedItemId = state.draggedItem.id
    const currentLastDropTarget = lastDropTarget
    const currentDropPosition = lastDropPosition

    let targetElement = null
    let dropPosition = null

    // Strategy 1: Use lastDropTarget (visually highlighted - highest reliability)
    if (currentLastDropTarget && currentLastDropTarget.dataset?.id) {
      targetElement = currentLastDropTarget
      dropPosition = currentDropPosition
    }

    // Strategy 2: Direct DOM traversal
    if (!targetElement) {
      const target = e.target.closest('.content-item, .tree-item')
      if (target && target.dataset.id !== draggedItemId) {
        targetElement = target
        dropPosition = getDropPosition(e, target)
      }
    }

    // Strategy 3: Search nearby elements
    if (!targetElement) {
      const nearbyTarget = findNearbyDropTarget(
        e.clientX,
        e.clientY,
        draggedItemId,
      )
      if (nearbyTarget) {
        targetElement = nearbyTarget
        dropPosition = getDropPosition(e, nearbyTarget)
      }
    }

    // Strategy 4: Drop on pane content (move to current folder)
    if (!targetElement) {
      const paneContent = e.target.closest('.pane-content')
      if (paneContent) {
        const paneNum = parseInt(paneContent.dataset.pane)
        const currentFolderId = state.panes[paneNum]?.currentFolderId
        if (currentFolderId && currentFolderId !== draggedItemId) {
          // Move to current folder (existing behavior)
          try {
            const [originalNode] = await chrome.bookmarks.get(draggedItemId)
            const originalParentId = originalNode.parentId
            const originalIndex = originalNode.index

            await chrome.bookmarks.move(draggedItemId, {
              parentId: currentFolderId,
            })

            pushUndoAction({
              type: 'move',
              itemId: draggedItemId,
              originalParentId: originalParentId,
              originalIndex: originalIndex,
            })

            showToast('Item moved successfully', 'success')
            await loadPaneContent(1)
            if (state.viewMode === 'split') {
              await loadPaneContent(2)
            }
            await loadFolderTree()
          } catch (error) {
            showToast('Failed to move item', 'error')
            console.error('Move failed:', error)
          }

          updateDropIndicator(null, null)
          document
            .querySelectorAll('.drag-over')
            .forEach((el) => el.classList.remove('drag-over'))
          state.draggedItem = null
          lastDropTarget = null
          lastDropPosition = null
          document.body.classList.remove('dragging-active')
          return
        }
      }
    }

    // No valid target found
    if (!targetElement || !dropPosition) {
      updateDropIndicator(null, null)
      document
        .querySelectorAll('.drag-over')
        .forEach((el) => el.classList.remove('drag-over'))
      state.draggedItem = null
      lastDropTarget = null
      lastDropPosition = null
      document.body.classList.remove('dragging-active')
      return
    }

    const targetId = targetElement.dataset.id
    const isTargetFolder = targetElement.dataset.isFolder === 'true'

    try {
      // Capture original position before move for undo
      const [originalNode] = await chrome.bookmarks.get(draggedItemId)
      const originalParentId = originalNode.parentId
      const originalIndex = originalNode.index

      let moveDestination = {}

      if (dropPosition === 'into' && isTargetFolder) {
        // Move into folder (existing behavior)
        moveDestination = { parentId: targetId }
      } else {
        // Reorder: move before or after target item
        const [targetNode] = await chrome.bookmarks.get(targetId)
        const targetParentId = targetNode.parentId
        let targetIndex = targetNode.index

        // Calculate new index
        if (dropPosition === 'after') {
          targetIndex += 1
        }

        // Adjust index if moving within the same folder and from before the target
        if (
          originalParentId === targetParentId &&
          originalIndex < targetIndex
        ) {
          targetIndex -= 1
        }

        moveDestination = { parentId: targetParentId, index: targetIndex }
      }

      await chrome.bookmarks.move(draggedItemId, moveDestination)

      // Push undo action
      pushUndoAction({
        type: 'move',
        itemId: draggedItemId,
        originalParentId: originalParentId,
        originalIndex: originalIndex,
      })

      const action = dropPosition === 'into' ? 'moved to folder' : 'reordered'
      showToast(`Item ${action} successfully`, 'success')

      // Refresh both panes
      await loadPaneContent(1)
      if (state.viewMode === 'split') {
        await loadPaneContent(2)
      }
      await loadFolderTree()
    } catch (error) {
      showToast('Failed to move item', 'error')
      console.error('Move failed:', error)
    }

    updateDropIndicator(null, null)
    document
      .querySelectorAll('.drag-over')
      .forEach((el) => el.classList.remove('drag-over'))
    state.draggedItem = null
    lastDropTarget = null
    lastDropPosition = null
    document.body.classList.remove('dragging-active')
  })
}

// ============================================
// Context Menu
// ============================================
function setupContextMenu() {
  document.addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.content-item')
    const paneContent = e.target.closest('.pane-content')

    if (item) {
      e.preventDefault()
      const paneNum = parseInt(item.closest('.explorer-pane').dataset.pane)
      setActivePane(paneNum)
      selectItem(paneNum, item)
      showContextMenu(e.clientX, e.clientY, item, paneNum)
    } else if (paneContent) {
      e.preventDefault()
      const paneNum = parseInt(paneContent.dataset.pane)
      setActivePane(paneNum)
      clearSelection(paneNum)
      showContextMenu(e.clientX, e.clientY, null, paneNum)
    }
  })

  elements.contextMenu.addEventListener('click', async (e) => {
    const menuItem = e.target.closest('.context-menu-item')
    if (!menuItem || menuItem.classList.contains('disabled')) return

    const action = menuItem.dataset.action
    const targetId = elements.contextMenu.dataset.targetId
    const paneNum = parseInt(elements.contextMenu.dataset.pane)

    hideContextMenu()

    await handleContextAction(action, targetId, paneNum)
  })

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu')) {
      hideContextMenu()
    }
  })
}

function showContextMenu(x, y, targetItem, paneNum) {
  const menu = elements.contextMenu
  menu.dataset.targetId = targetItem ? targetItem.dataset.id : ''
  menu.dataset.pane = paneNum

  // Show/hide relevant items
  const openItems = menu.querySelectorAll(
    '[data-action="open"], [data-action="open-new-tab"]',
  )
  const openOtherPane = menu.querySelector('[data-action="open-other-pane"]')
  const itemActions = menu.querySelectorAll(
    '[data-action="rename"], [data-action="delete"], [data-action="cut"], [data-action="copy"]',
  )
  const pasteAction = menu.querySelector('[data-action="paste"]')

  if (targetItem) {
    openItems.forEach((el) => (el.style.display = ''))
    itemActions.forEach((el) => (el.style.display = ''))

    if (targetItem.dataset.isFolder === 'true') {
      menu.querySelector('[data-action="open-new-tab"]').style.display = 'none'
    }

    // Show "Open in Other Pane" only in split mode
    if (state.viewMode === 'split' && targetItem.dataset.isFolder === 'true') {
      openOtherPane.style.display = ''
    } else {
      openOtherPane.style.display = 'none'
    }
  } else {
    openItems.forEach((el) => (el.style.display = 'none'))
    openOtherPane.style.display = 'none'
    itemActions.forEach((el) => (el.style.display = 'none'))
  }

  // Enable/disable paste based on clipboard
  if (state.clipboard) {
    pasteAction.classList.remove('disabled')
  } else {
    pasteAction.classList.add('disabled')
  }

  // Position menu
  menu.style.left = `${Math.min(x, window.innerWidth - 220)}px`
  menu.style.top = `${Math.min(y, window.innerHeight - 350)}px`
  menu.classList.add('visible')
}

function hideContextMenu() {
  elements.contextMenu.classList.remove('visible')
}

async function handleContextAction(action, targetId, paneNum) {
  switch (action) {
    case 'undo':
      await performUndo()
      break

    case 'open':
      if (targetId) {
        const item = document.querySelector(
          `.content-item[data-id="${targetId}"]`,
        )
        if (item.dataset.isFolder === 'true') {
          await navigatePane(paneNum, targetId)
        } else if (item.dataset.url) {
          chrome.tabs.update({ url: item.dataset.url })
        }
      }
      break

    case 'open-new-tab':
      if (targetId) {
        const item = document.querySelector(
          `.content-item[data-id="${targetId}"]`,
        )
        if (item.dataset.url) {
          chrome.tabs.create({ url: item.dataset.url })
        }
      }
      break

    case 'open-other-pane':
      if (targetId && state.viewMode === 'split') {
        const otherPane = paneNum === 1 ? 2 : 1
        await navigatePane(otherPane, targetId)
        setActivePane(otherPane)
      }
      break

    case 'copy':
      if (targetId) {
        state.clipboard = { action: 'copy', id: targetId, sourcePane: paneNum }
        showToast('Item copied to clipboard', 'info')
      }
      break

    case 'paste':
      if (state.clipboard) {
        await pasteItem(paneNum)
      }
      break

    case 'rename':
      if (targetId) showRenameDialog(targetId)
      break

    case 'delete':
      if (targetId) await deleteItem(targetId)
      break

    case 'new-folder':
      showNewFolderDialog(paneNum)
      break

    case 'new-bookmark':
      showNewBookmarkDialog(paneNum)
      break
  }
}

async function pasteItem(paneNum) {
  if (!state.clipboard) return

  const targetFolderId = state.panes[paneNum].currentFolderId

  try {
    // Copy - get bookmark and create copy
    const [original] = await chrome.bookmarks.get(state.clipboard.id)
    let created

    if (original.url) {
      created = await chrome.bookmarks.create({
        parentId: targetFolderId,
        title: original.title,
        url: original.url,
      })
    } else {
      // Copy folder (shallow - just the folder itself)
      created = await chrome.bookmarks.create({
        parentId: targetFolderId,
        title: original.title + ' (copy)',
      })
    }

    // Push undo action
    pushUndoAction({
      type: 'paste',
      createdId: created.id,
    })

    showToast('Item copied', 'success')

    state.clipboard = null

    await loadPaneContent(1)
    if (state.viewMode === 'split') {
      await loadPaneContent(2)
    }
    await loadFolderTree()
  } catch (error) {
    showToast('Paste failed', 'error')
    console.error('Paste failed:', error)
  }
}

// ============================================
// Dialogs
// ============================================
function setupDialogs() {
  // Rename
  const renameDialog = document.getElementById('rename-dialog')
  document.getElementById('rename-ok').addEventListener('click', confirmRename)
  document
    .getElementById('rename-cancel')
    .addEventListener('click', () => hideDialog(renameDialog))
  renameDialog
    .querySelector('.dialog-close')
    .addEventListener('click', () => hideDialog(renameDialog))
  document.getElementById('rename-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmRename()
    if (e.key === 'Escape') hideDialog(renameDialog)
  })

  // New Folder
  const newFolderDialog = document.getElementById('new-folder-dialog')
  document
    .getElementById('new-folder-ok')
    .addEventListener('click', confirmNewFolder)
  document
    .getElementById('new-folder-cancel')
    .addEventListener('click', () => hideDialog(newFolderDialog))
  newFolderDialog
    .querySelector('.dialog-close')
    .addEventListener('click', () => hideDialog(newFolderDialog))
  document
    .getElementById('new-folder-input')
    .addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmNewFolder()
      if (e.key === 'Escape') hideDialog(newFolderDialog)
    })

  // New Bookmark
  const newBookmarkDialog = document.getElementById('new-bookmark-dialog')
  document
    .getElementById('new-bookmark-ok')
    .addEventListener('click', confirmNewBookmark)
  document
    .getElementById('new-bookmark-cancel')
    .addEventListener('click', () => hideDialog(newBookmarkDialog))
  newBookmarkDialog
    .querySelector('.dialog-close')
    .addEventListener('click', () => hideDialog(newBookmarkDialog))
  document
    .getElementById('new-bookmark-url')
    .addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmNewBookmark()
      if (e.key === 'Escape') hideDialog(newBookmarkDialog)
    })

  // Close on overlay click
  document.querySelectorAll('.dialog-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideDialog(overlay)
    })
  })
}

function showDialog(dialog) {
  dialog.classList.add('visible')
  const input = dialog.querySelector('input')
  if (input) {
    setTimeout(() => {
      input.focus()
      input.select()
    }, 100)
  }
}

function hideDialog(dialog) {
  dialog.classList.remove('visible')
}

function hideAllDialogs() {
  document
    .querySelectorAll('.dialog-overlay')
    .forEach((d) => d.classList.remove('visible'))
}

// Rename
async function showRenameDialog(id) {
  const [node] = await chrome.bookmarks.get(id)
  if (!node) return

  const input = document.getElementById('rename-input')
  input.value = node.title

  const dialog = document.getElementById('rename-dialog')
  dialog.dataset.targetId = id
  showDialog(dialog)
}

async function confirmRename() {
  const dialog = document.getElementById('rename-dialog')
  const id = dialog.dataset.targetId
  const newTitle = document.getElementById('rename-input').value.trim()

  if (!newTitle) return

  try {
    // Capture original title before rename for undo
    const [node] = await chrome.bookmarks.get(id)
    const originalTitle = node.title

    // Skip if title unchanged
    if (originalTitle === newTitle) {
      hideDialog(dialog)
      return
    }

    await chrome.bookmarks.update(id, { title: newTitle })

    // Push undo action
    pushUndoAction({
      type: 'rename',
      itemId: id,
      originalTitle: originalTitle,
    })

    showToast('Renamed successfully', 'success')

    await loadPaneContent(1)
    if (state.viewMode === 'split') await loadPaneContent(2)
    await loadFolderTree()
  } catch (error) {
    showToast('Failed to rename', 'error')
  }

  hideDialog(dialog)
}

// New Folder
function showNewFolderDialog(paneNum) {
  const input = document.getElementById('new-folder-input')
  input.value = 'New Folder'

  const dialog = document.getElementById('new-folder-dialog')
  dialog.dataset.pane = paneNum
  showDialog(dialog)
}

async function confirmNewFolder() {
  const dialog = document.getElementById('new-folder-dialog')
  const paneNum = parseInt(dialog.dataset.pane)
  const title = document.getElementById('new-folder-input').value.trim()

  if (!title) return

  try {
    const created = await chrome.bookmarks.create({
      parentId: state.panes[paneNum].currentFolderId,
      title: title,
    })

    // Push undo action
    pushUndoAction({
      type: 'create',
      createdId: created.id,
    })

    showToast('Folder created', 'success')

    await loadPaneContent(paneNum)
    await loadFolderTree()
  } catch (error) {
    showToast('Failed to create folder', 'error')
  }

  hideDialog(dialog)
}

// New Bookmark
function showNewBookmarkDialog(paneNum) {
  document.getElementById('new-bookmark-title').value = ''
  document.getElementById('new-bookmark-url').value = ''

  const dialog = document.getElementById('new-bookmark-dialog')
  dialog.dataset.pane = paneNum
  showDialog(dialog)
}

async function confirmNewBookmark() {
  const dialog = document.getElementById('new-bookmark-dialog')
  const paneNum = parseInt(dialog.dataset.pane)
  const title = document.getElementById('new-bookmark-title').value.trim()
  const url = document.getElementById('new-bookmark-url').value.trim()

  if (!title || !url) return

  try {
    const created = await chrome.bookmarks.create({
      parentId: state.panes[paneNum].currentFolderId,
      title: title,
      url: url,
    })

    // Push undo action
    pushUndoAction({
      type: 'create',
      createdId: created.id,
    })

    showToast('Bookmark created', 'success')

    await loadPaneContent(paneNum)
  } catch (error) {
    showToast('Failed to create bookmark', 'error')
  }

  hideDialog(dialog)
}

// Delete
async function deleteItem(id) {
  const [node] = await chrome.bookmarks.get(id)
  if (!node) return

  const isFolder = !node.url
  const message = isFolder
    ? `Delete folder "${node.title}" and all its contents?`
    : `Delete bookmark "${node.title}"?`

  if (!confirm(message)) return

  try {
    // Capture full data before deletion for undo
    const fullData = await captureBookmarkTree(id)
    const parentId = node.parentId
    const index = node.index

    if (isFolder) {
      await chrome.bookmarks.removeTree(id)
    } else {
      await chrome.bookmarks.remove(id)
    }

    // Push undo action
    pushUndoAction({
      type: 'delete',
      data: fullData,
      parentId: parentId,
      index: index,
    })

    showToast('Deleted successfully', 'success')

    await loadPaneContent(1)
    if (state.viewMode === 'split') await loadPaneContent(2)
    await loadFolderTree()
  } catch (error) {
    showToast('Failed to delete', 'error')
  }
}

// ============================================
// Search
// ============================================
function setupSearch() {
  document.querySelectorAll('.search-input').forEach((input) => {
    let searchTimeout
    const paneNum = parseInt(input.dataset.pane)

    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout)
      const query = e.target.value.trim()

      if (query.length < 2) {
        loadPaneContent(paneNum)
        return
      }

      searchTimeout = setTimeout(() => performSearch(paneNum, query), 300)
    })
  })
}

async function performSearch(paneNum, query) {
  const content = document.querySelector(
    `.pane-content[data-pane="${paneNum}"]`,
  )
  const results = await chrome.bookmarks.search(query)

  content.innerHTML = ''

  if (results.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-text">No results for "${escapeHtml(query)}"</div>
      </div>
    `
    updatePaneStatus(paneNum, 0)
    return
  }

  results.forEach((node) => renderContentItem(node, content))
  updatePaneStatus(paneNum, results.length)

  const statusText = document.querySelector(
    `.status-text[data-pane="${paneNum}"]`,
  )
  statusText.textContent = `Search: "${query}"`
}

// ============================================
// Keyboard Shortcuts
// ============================================
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in input
    if (e.target.matches('input')) return

    const paneNum = state.activePane
    const paneState = state.panes[paneNum]

    // Ctrl+Z / Cmd+Z - Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      performUndo()
      return
    }

    // Delete
    if (e.key === 'Delete' && paneState.selectedItems.size > 0) {
      const firstSelected = paneState.selectedItems.values().next().value
      deleteItem(firstSelected)
    }

    // F2 Rename
    if (e.key === 'F2' && paneState.selectedItems.size === 1) {
      const firstSelected = paneState.selectedItems.values().next().value
      showRenameDialog(firstSelected)
    }

    // Backspace - go up
    if (e.key === 'Backspace') {
      e.preventDefault()
      handlePaneAction(paneNum, 'up')
    }

    // Escape
    if (e.key === 'Escape') {
      hideContextMenu()
      hideAllDialogs()
    }

    // Ctrl+C Copy
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key === 'c' &&
      paneState.selectedItems.size === 1
    ) {
      const firstSelected = paneState.selectedItems.values().next().value
      handleContextAction('copy', firstSelected, paneNum)
    }

    // Ctrl+V Paste
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && state.clipboard) {
      pasteItem(paneNum)
    }

    // Tab - switch panes in split mode
    if (e.key === 'Tab' && state.viewMode === 'split') {
      e.preventDefault()
      const otherPane = paneNum === 1 ? 2 : 1
      setActivePane(otherPane)
    }
  })
}

// ============================================
// Resizers
// ============================================
function setupResizers() {
  // Sidebar resizer
  let sidebarDragging = false

  elements.sidebarResizer.addEventListener('mousedown', (e) => {
    sidebarDragging = true
    elements.sidebarResizer.classList.add('dragging')
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  })

  document.addEventListener('mousemove', (e) => {
    if (sidebarDragging) {
      const newWidth = Math.max(180, Math.min(400, e.clientX))
      elements.sidebar.style.width = `${newWidth}px`
      state.sidebarWidth = newWidth
    }
  })

  document.addEventListener('mouseup', () => {
    if (sidebarDragging) {
      sidebarDragging = false
      elements.sidebarResizer.classList.remove('dragging')
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      saveState()
    }
  })

  // Pane splitter
  let paneDragging = false

  elements.paneSplitter.addEventListener('mousedown', (e) => {
    paneDragging = true
    elements.paneSplitter.classList.add('dragging')
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  })

  document.addEventListener('mousemove', (e) => {
    if (paneDragging) {
      const contentArea = elements.contentArea
      const contentRect = contentArea.getBoundingClientRect()
      const sidebarWidth = elements.sidebar.offsetWidth + 5 // sidebar + resizer
      const relativeX = e.clientX - contentRect.left
      const percentage = (relativeX / contentRect.width) * 100

      const pane1 = document.getElementById('pane-1')
      const pane2 = document.getElementById('pane-2')

      const clampedPercentage = Math.max(30, Math.min(70, percentage))
      pane1.style.flex = `0 0 ${clampedPercentage}%`
      pane2.style.flex = `0 0 ${100 - clampedPercentage - 1}%`
    }
  })

  document.addEventListener('mouseup', () => {
    if (paneDragging) {
      paneDragging = false
      elements.paneSplitter.classList.remove('dragging')
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  })
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div')
  toast.className = `toast ${type}`

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
  }

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span>${escapeHtml(message)}</span>
  `

  elements.toastContainer.appendChild(toast)

  setTimeout(() => {
    toast.style.animation = 'toastSlideIn 0.3s ease reverse'
    setTimeout(() => toast.remove(), 300)
  }, 3000)
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
  const [subtree] = await chrome.bookmarks.getSubTree(id)
  return subtree
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
    index,
  }

  // Only add URL for bookmarks (not folders)
  if (node.url) {
    createData.url = node.url
  }

  const created = await chrome.bookmarks.create(createData)

  // If folder with children, restore children recursively
  if (node.children && node.children.length > 0) {
    for (let i = 0; i < node.children.length; i++) {
      await restoreBookmarkTree(node.children[i], created.id, i)
    }
  }

  return created
}

/**
 * Pushes an undo action to the stack.
 * @param {Object} action - Undo action data
 */
function pushUndoAction(action) {
  state.undoStack.push({
    ...action,
    timestamp: Date.now(),
  })

  // Limit stack size
  if (state.undoStack.length > MAX_UNDO_STACK_SIZE) {
    state.undoStack.shift()
  }

  updateUndoButtons()
}

/**
 * Updates the disabled state of all undo buttons.
 */
function updateUndoButtons() {
  const hasUndoActions = state.undoStack.length > 0
  document.querySelectorAll('[data-action="undo"]').forEach((btn) => {
    btn.disabled = !hasUndoActions
    if (btn.classList.contains('context-menu-item')) {
      btn.classList.toggle('disabled', !hasUndoActions)
    }
  })
}

/**
 * Performs the undo operation for the most recent action.
 */
async function performUndo() {
  if (state.undoStack.length === 0) {
    showToast('Nothing to undo', 'info')
    return
  }

  const action = state.undoStack.pop()
  updateUndoButtons()

  try {
    switch (action.type) {
      case 'delete':
        // Restore deleted bookmark/folder
        await restoreBookmarkTree(action.data, action.parentId, action.index)
        showToast(`Restored "${action.data.title}"`, 'success')
        break

      case 'move':
        // Move item back to original location
        await chrome.bookmarks.move(action.itemId, {
          parentId: action.originalParentId,
          index: action.originalIndex,
        })
        showToast('Move undone', 'success')
        break

      case 'rename':
        // Restore original title
        await chrome.bookmarks.update(action.itemId, {
          title: action.originalTitle,
        })
        showToast('Rename undone', 'success')
        break

      case 'create':
        // Delete the created item
        const [node] = await chrome.bookmarks.get(action.createdId)
        if (node) {
          if (node.url) {
            await chrome.bookmarks.remove(action.createdId)
          } else {
            await chrome.bookmarks.removeTree(action.createdId)
          }
        }
        showToast('Creation undone', 'success')
        break

      case 'paste':
        // Delete the pasted item
        const [pastedNode] = await chrome.bookmarks.get(action.createdId)
        if (pastedNode) {
          if (pastedNode.url) {
            await chrome.bookmarks.remove(action.createdId)
          } else {
            await chrome.bookmarks.removeTree(action.createdId)
          }
        }
        showToast('Paste undone', 'success')
        break

      default:
        showToast('Unknown action type', 'error')
        return
    }

    // Refresh UI
    await loadPaneContent(1)
    if (state.viewMode === 'split') {
      await loadPaneContent(2)
    }
    await loadFolderTree()
  } catch (error) {
    console.error('Undo failed:', error)
    showToast('Undo failed: ' + error.message, 'error')
  }
}

// ============================================
// Utilities
// ============================================
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
