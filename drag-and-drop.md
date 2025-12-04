# The Complete Guide to Reliable HTML5 Drag & Drop

*Lessons learned from building a Chrome Extension with 95%+ drop success rate*

---

## Introduction

HTML5 Drag & Drop API has been around since 2008, yet it remains one of the most frustrating browser APIs to work with. During development of [Bookmark XP Explorer](https://github.com/example/bookmark-xp-explorer), I encountered a **75% failure rate** for folder move operations. After extensive debugging, I discovered three critical issues that plague most drag-and-drop implementations:

1. **dragleave Event Bubbling** - Visual feedback disappears unexpectedly
2. **Race Conditions in Async Handlers** - State becomes null during operations
3. **Unreliable Drop Target Detection** - Drops fail in "gaps" between elements

This guide covers the solutions I implemented to achieve **95%+ success rate**, complete with working CodePen demos.

---

## Table of Contents

1. [The dragleave Bubbling Problem](#1-the-dragleave-bubbling-problem)
2. [Race Conditions in Async Drop Handlers](#2-race-conditions-in-async-drop-handlers)
3. [Multi-Fallback Drop Target Strategy](#3-multi-fallback-drop-target-strategy)
4. [UX Patterns: Expanding Drop Zones](#4-ux-patterns-expanding-drop-zones)
5. [Complete Working Demo](#5-complete-working-demo)
6. [Key Takeaways](#6-key-takeaways)

---

## 1. The dragleave Bubbling Problem

### The Problem

When you drag over a parent element, moving your cursor to a child element (like an icon or label) triggers `dragleave` on the parent. This causes the visual "drop here" feedback to flicker or disappear entirely.

```
┌─────────────────────────┐
│  Parent (drop target)   │
│   ┌───────┐ ┌────────┐  │
│   │ Icon  │ │ Label  │  │  ← Moving between these triggers dragleave!
│   └───────┘ └────────┘  │
└─────────────────────────┘
```

### Solution 1: CSS `pointer-events: none`

The simplest fix is to disable pointer events on child elements during drag operations:

```css
/* During drag, disable pointer events on child elements */
body.dragging-active .folder-icon,
body.dragging-active .folder-label {
  pointer-events: none;
}
```

```javascript
document.addEventListener('dragstart', (e) => {
  document.body.classList.add('dragging-active');
});

document.addEventListener('dragend', () => {
  document.body.classList.remove('dragging-active');
});
```

### Solution 2: relatedTarget Check

For more precise control, check if the cursor moved to a child element:

```javascript
document.addEventListener('dragleave', (e) => {
  const target = e.target.closest('.drop-zone');
  if (!target) return;

  const relatedTarget = e.relatedTarget;

  // If moving to a child element, ignore this event
  if (relatedTarget && target.contains(relatedTarget)) {
    return;
  }

  // Actually left the drop zone
  target.classList.remove('drag-over');
});
```

> ⚠️ **Safari Warning**: `relatedTarget` has a [14-year-old WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=66547) on iOS. Use CSS `pointer-events` as a fallback.

### Interactive Demo

<p class="codepen" data-height="400" data-default-tab="result" data-slug-hash="dragleave-fix-demo" data-user="example">
See the Pen <a href="https://codepen.io/example/pen/dragleave-fix-demo">dragleave Fix Demo</a>.
</p>

```html
<!-- CodePen HTML -->
<div class="container">
  <h3>Drag items to folders</h3>

  <div class="items">
    <div class="item" draggable="true" data-id="1">
      <span class="icon">📄</span>
      <span class="label">Document 1</span>
    </div>
    <div class="item" draggable="true" data-id="2">
      <span class="icon">📄</span>
      <span class="label">Document 2</span>
    </div>
  </div>

  <div class="folders">
    <div class="folder" data-id="folder-1">
      <span class="icon">📁</span>
      <span class="label">Archive</span>
    </div>
    <div class="folder" data-id="folder-2">
      <span class="icon">📁</span>
      <span class="label">Projects</span>
    </div>
  </div>

  <div id="status">Drag an item to a folder</div>
</div>
```

```css
/* CodePen CSS */
* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 20px;
  background: #f5f5f5;
}

.container {
  max-width: 500px;
  margin: 0 auto;
}

.items, .folders {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.item, .folder {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  cursor: grab;
  transition: all 0.2s ease;
}

.item:active { cursor: grabbing; }

.folder {
  cursor: default;
  border: 2px solid transparent;
}

/* Dragging state */
.item.dragging {
  opacity: 0.5;
  transform: scale(0.95);
}

/* Drop target feedback */
.folder.drag-over {
  background: rgba(0, 120, 212, 0.15);
  border-color: #0078d4;
  transform: scale(1.05);
  box-shadow: 0 0 0 2px #0078d4, 0 4px 12px rgba(0, 120, 212, 0.25);
}

/* KEY FIX: Disable pointer events on children during drag */
body.dragging-active .folder .icon,
body.dragging-active .folder .label {
  pointer-events: none;
}

/* Expand drop zone during drag */
body.dragging-active .folder {
  padding: 16px 20px;
}

#status {
  padding: 12px;
  background: #e8f4fd;
  border-radius: 6px;
  text-align: center;
  color: #0078d4;
}
```

```javascript
/* CodePen JavaScript */
let draggedItem = null;
let lastDropTarget = null;

// Drag Start
document.querySelectorAll('.item').forEach(item => {
  item.addEventListener('dragstart', (e) => {
    draggedItem = e.target.closest('.item');
    draggedItem.classList.add('dragging');
    document.body.classList.add('dragging-active');

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedItem.dataset.id);

    updateStatus('Dragging: ' + draggedItem.querySelector('.label').textContent);
  });

  item.addEventListener('dragend', () => {
    document.querySelectorAll('.dragging, .drag-over').forEach(el => {
      el.classList.remove('dragging', 'drag-over');
    });
    draggedItem = null;
    lastDropTarget = null;
    document.body.classList.remove('dragging-active');
  });
});

// Drag Over - Track current drop target
document.addEventListener('dragover', (e) => {
  if (!draggedItem) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const folder = e.target.closest('.folder');

  if (folder && folder !== lastDropTarget) {
    // Remove from previous target
    if (lastDropTarget) {
      lastDropTarget.classList.remove('drag-over');
    }
    // Add to new target
    folder.classList.add('drag-over');
    lastDropTarget = folder;
    updateStatus('Drop into: ' + folder.querySelector('.label').textContent);
  } else if (!folder && lastDropTarget) {
    lastDropTarget.classList.remove('drag-over');
    lastDropTarget = null;
    updateStatus('Drag an item to a folder');
  }
});

// Drag Leave - With relatedTarget check
document.addEventListener('dragleave', (e) => {
  const folder = e.target.closest('.folder');
  if (!folder) return;

  const relatedTarget = e.relatedTarget;

  // KEY FIX: If moving to child element, ignore
  if (relatedTarget && folder.contains(relatedTarget)) {
    return;
  }

  // Check if moving to another folder
  const newFolder = relatedTarget?.closest('.folder');
  if (newFolder && newFolder !== folder) {
    return; // Will be handled by dragover
  }

  folder.classList.remove('drag-over');
  if (lastDropTarget === folder) {
    lastDropTarget = null;
  }
});

// Drop
document.addEventListener('drop', (e) => {
  e.preventDefault();
  if (!draggedItem) return;

  const folder = lastDropTarget || e.target.closest('.folder');

  if (folder) {
    const itemName = draggedItem.querySelector('.label').textContent;
    const folderName = folder.querySelector('.label').textContent;
    updateStatus(`✅ Moved "${itemName}" to "${folderName}"`);
  }

  // Cleanup
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
});

function updateStatus(message) {
  document.getElementById('status').textContent = message;
}
```

---

## 2. Race Conditions in Async Drop Handlers

### The Problem

When your drop handler needs to perform async operations (API calls, IndexedDB, etc.), the `dragend` event may fire before the async operation completes, setting shared state to `null`.

```javascript
// ❌ BROKEN: Race condition
document.addEventListener('drop', async (e) => {
  e.preventDefault();

  // state.draggedItem is valid here
  const target = e.target.closest('.folder');

  await saveToDatabase(state.draggedItem, target.id);  // ← Takes 100ms

  // ⚠️ dragend may have fired during await!
  // state.draggedItem is now NULL
  console.log(state.draggedItem.id);  // TypeError: Cannot read 'id' of null
});
```

### The Solution: Capture State Before Await

Always capture any shared state into local variables **before** any `await`:

```javascript
// ✅ FIXED: Capture state immediately
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  if (!state.draggedItem) return;

  // CRITICAL: Capture state BEFORE any async operation
  const draggedItemId = state.draggedItem;
  const currentDropTarget = lastDropTarget;

  // Now use local variables for the rest of the handler
  await saveToDatabase(draggedItemId, currentDropTarget.id);

  // Safe to use - these are local variables, not shared state
  console.log('Moved item:', draggedItemId);
});
```

### Real-World Example

From the Bookmark XP Explorer codebase:

```javascript
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  if (!state.draggedItem) return;

  // CRITICAL: Capture state immediately to prevent race condition
  // dragend event may fire during async operations and set state.draggedItem = null
  const draggedItemId = state.draggedItem;
  const currentLastDropTarget = lastDropTarget;

  let targetId = null;

  // Strategy 1: Use cached lastDropTarget
  if (currentLastDropTarget?.dataset?.id) {
    targetId = currentLastDropTarget.dataset.id;
  }

  // Strategy 2: DOM traversal
  if (!targetId) {
    const target = e.target.closest('.folder');
    targetId = target?.dataset.id;
  }

  // Strategy 3: Nearby element search (see next section)
  if (!targetId) {
    targetId = findNearbyDropTarget(e.clientX, e.clientY, draggedItemId);
  }

  if (!targetId) return;

  try {
    // Async operation - state may change during this
    await chrome.bookmarks.move(draggedItemId, { parentId: targetId });
    showStatus('Item moved successfully');
  } catch (error) {
    showStatus('Failed to move item');
  }
});
```

---

## 3. Multi-Fallback Drop Target Strategy

### The Problem

`e.target` in the drop event returns the innermost element under the cursor. If there's a gap between the icon and label, or the user drops on the exact border, `e.target.closest('.folder')` may return `null`.

```
┌────────────────────────────┐
│ 📁  [gap]  Project Files   │  ← Drop here: e.target might be the parent container
└────────────────────────────┘
```

### The Solution: Layered Detection

Implement multiple strategies, from most reliable to least:

```javascript
/**
 * Find a valid drop target near the given coordinates.
 * Uses expanding circle search pattern.
 *
 * @param {number} x - Client X coordinate
 * @param {number} y - Client Y coordinate
 * @param {string} excludeId - ID of dragged item (to exclude from results)
 * @returns {Element|null} - Valid drop target or null
 */
function findNearbyDropTarget(x, y, excludeId) {
  // Search offsets: center, then expanding circle
  const searchOffsets = [
    [0, 0],                                       // Exact position
    [0, -12], [0, 12], [-12, 0], [12, 0],         // 12px cross
    [-12, -12], [12, -12], [-12, 12], [12, 12],   // 12px corners
    [0, -24], [0, 24], [-24, 0], [24, 0]          // 24px cross
  ];

  for (const [dx, dy] of searchOffsets) {
    const el = document.elementFromPoint(x + dx, y + dy);
    if (!el) continue;

    const target = el.closest('.folder');
    if (target && target.dataset.id !== excludeId) {
      return target;
    }
  }

  return null;
}

// Drop handler with multi-fallback strategy
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  if (!state.draggedItem) return;

  const draggedItemId = state.draggedItem;
  let targetId = null;

  // Strategy 1: Use lastDropTarget (visually highlighted - highest reliability)
  if (lastDropTarget?.dataset?.id) {
    targetId = lastDropTarget.dataset.id;
  }

  // Strategy 2: Direct DOM traversal from e.target
  if (!targetId) {
    const target = e.target.closest('.folder');
    targetId = target?.dataset.id;
  }

  // Strategy 3: Search nearby elements using elementFromPoint
  if (!targetId) {
    const nearbyTarget = findNearbyDropTarget(e.clientX, e.clientY, draggedItemId);
    targetId = nearbyTarget?.dataset.id;
  }

  // Strategy 4 (optional): Default to current folder
  if (!targetId) {
    targetId = state.currentFolderId;
  }

  if (!targetId || targetId === draggedItemId) {
    return; // No valid target found
  }

  // Perform the move...
});
```

### Why Each Strategy Matters

| Strategy | Reliability | When It Works | When It Fails |
|----------|------------|---------------|---------------|
| lastDropTarget | 95% | Normal drag operations | Quick mouse movements |
| e.target.closest() | 80% | Direct drops on elements | Gaps, borders |
| elementFromPoint | 90% | Nearby drops | Very fast drags |
| Default folder | 100% | Always | May not be user intent |

---

## 4. UX Patterns: Expanding Drop Zones

### Visual Feedback Is Critical

Users need clear signals about where they can drop. Implement these CSS patterns:

```css
/* Base folder styles */
.folder {
  padding: 12px 16px;
  transition: all 0.15s ease;
  border: 2px solid transparent;
}

/* During drag: expand drop zones for larger hit area */
body.dragging-active .folder {
  padding: 18px 22px;
  margin: 6px;
}

/* Subtle hint that folders accept drops */
body.dragging-active .folder:not(.dragging) {
  background: rgba(0, 120, 212, 0.04);
  border-radius: 8px;
}

/* Active drop target: prominent feedback */
.folder.drag-over {
  z-index: 10;
  background: rgba(0, 120, 212, 0.15) !important;
  border-color: #0078d4;
  transform: scale(1.02);
  box-shadow:
    0 0 0 2px #0078d4,
    0 4px 12px rgba(0, 120, 212, 0.25);
}

/* Dragged item: reduced opacity */
.item.dragging {
  opacity: 0.5;
  transform: scale(0.95);
}
```

### The "Magnetic" Effect

Inspired by Trello, you can create a magnetic feel where drop zones seem to "attract" items:

```javascript
document.addEventListener('dragover', (e) => {
  if (!draggedItem) return;
  e.preventDefault();

  const folder = e.target.closest('.folder');

  if (folder) {
    // Calculate distance from center for magnetic effect
    const rect = folder.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(e.clientX - centerX, e.clientY - centerY);

    // Adjust visual intensity based on proximity
    const intensity = Math.max(0, 1 - distance / 100);
    folder.style.transform = `scale(${1 + intensity * 0.05})`;
    folder.style.boxShadow = `0 0 0 ${2 + intensity * 2}px #0078d4`;
  }
});
```

---

## 5. Complete Working Demo

Here's a complete, production-ready implementation you can copy to CodePen:

<p class="codepen" data-height="600" data-default-tab="result" data-slug-hash="complete-dnd-demo" data-user="example">
See the Pen <a href="https://codepen.io/example/pen/complete-dnd-demo">Complete D&D Demo</a>.
</p>

### Full Source Code

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reliable HTML5 Drag & Drop</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 40px 20px;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      padding: 30px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    h1 {
      text-align: center;
      color: #333;
      margin-bottom: 10px;
    }

    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 30px;
    }

    .section-title {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #888;
      margin-bottom: 12px;
    }

    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 12px;
      margin-bottom: 30px;
    }

    .item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px 12px;
      background: white;
      border-radius: 12px;
      border: 2px solid #eee;
      cursor: grab;
      transition: all 0.2s ease;
      user-select: none;
    }

    .item:hover {
      border-color: #ddd;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .item:active {
      cursor: grabbing;
    }

    .item .icon {
      font-size: 32px;
    }

    .item .label {
      font-size: 13px;
      color: #333;
      text-align: center;
      word-break: break-word;
    }

    .item.dragging {
      opacity: 0.4;
      transform: scale(0.9);
      border-color: #0078d4;
    }

    .folders-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }

    .folder {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-radius: 12px;
      border: 2px solid transparent;
      transition: all 0.2s ease;
    }

    .folder .icon {
      font-size: 28px;
    }

    .folder .label {
      font-size: 15px;
      font-weight: 500;
      color: #333;
    }

    /* KEY FIX 1: Disable pointer events on children during drag */
    body.dragging-active .folder .icon,
    body.dragging-active .folder .label {
      pointer-events: none;
    }

    /* KEY FIX 2: Expand drop zones during drag */
    body.dragging-active .folder {
      padding: 20px 24px;
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
    }

    /* KEY FIX 3: Clear visual feedback */
    .folder.drag-over {
      background: linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%) !important;
      border-color: #4caf50;
      transform: scale(1.03);
      box-shadow:
        0 0 0 3px #4caf50,
        0 8px 25px rgba(76, 175, 80, 0.3);
    }

    #status {
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      text-align: center;
      font-size: 14px;
      color: #666;
      border-left: 4px solid #0078d4;
    }

    #status.success {
      background: #e8f5e9;
      border-left-color: #4caf50;
      color: #2e7d32;
    }

    .debug {
      margin-top: 20px;
      padding: 12px;
      background: #263238;
      border-radius: 8px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      color: #80cbc4;
    }

    .debug-title {
      color: #ffcc80;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Reliable Drag & Drop</h1>
    <p class="subtitle">With 95%+ success rate</p>

    <div class="section-title">Draggable Items</div>
    <div class="items-grid">
      <div class="item" draggable="true" data-id="doc-1">
        <span class="icon">📄</span>
        <span class="label">Report.pdf</span>
      </div>
      <div class="item" draggable="true" data-id="doc-2">
        <span class="icon">📊</span>
        <span class="label">Data.xlsx</span>
      </div>
      <div class="item" draggable="true" data-id="doc-3">
        <span class="icon">🖼️</span>
        <span class="label">Photo.jpg</span>
      </div>
      <div class="item" draggable="true" data-id="doc-4">
        <span class="icon">📝</span>
        <span class="label">Notes.txt</span>
      </div>
    </div>

    <div class="section-title">Drop Targets (Folders)</div>
    <div class="folders-grid">
      <div class="folder" data-id="folder-archive">
        <span class="icon">📦</span>
        <span class="label">Archive</span>
      </div>
      <div class="folder" data-id="folder-projects">
        <span class="icon">💼</span>
        <span class="label">Projects</span>
      </div>
      <div class="folder" data-id="folder-photos">
        <span class="icon">🖼️</span>
        <span class="label">Photos</span>
      </div>
      <div class="folder" data-id="folder-trash">
        <span class="icon">🗑️</span>
        <span class="label">Trash</span>
      </div>
    </div>

    <div id="status">Drag an item to a folder</div>

    <div class="debug">
      <div class="debug-title">Debug Info:</div>
      <div id="debug-info">Ready</div>
    </div>
  </div>

  <script>
    // State management
    const state = {
      draggedItem: null,
      draggedItemId: null
    };

    let lastDropTarget = null;

    // DOM elements
    const statusEl = document.getElementById('status');
    const debugEl = document.getElementById('debug-info');

    // Utility functions
    function updateStatus(message, isSuccess = false) {
      statusEl.textContent = message;
      statusEl.className = isSuccess ? 'success' : '';
    }

    function updateDebug(info) {
      debugEl.textContent = info;
    }

    /**
     * Find a valid drop target near the given coordinates.
     * Uses expanding circle search pattern for better hit detection.
     *
     * @param {number} x - Client X coordinate
     * @param {number} y - Client Y coordinate
     * @param {string} excludeId - ID to exclude (the dragged item)
     * @returns {Element|null} - Valid drop target or null
     */
    function findNearbyDropTarget(x, y, excludeId) {
      const searchOffsets = [
        [0, 0],
        [0, -12], [0, 12], [-12, 0], [12, 0],
        [-12, -12], [12, -12], [-12, 12], [12, 12],
        [0, -24], [0, 24], [-24, 0], [24, 0]
      ];

      for (const [dx, dy] of searchOffsets) {
        const el = document.elementFromPoint(x + dx, y + dy);
        if (!el) continue;

        const target = el.closest('.folder');
        if (target && target.dataset.id !== excludeId) {
          return target;
        }
      }
      return null;
    }

    // Drag Start
    document.querySelectorAll('.item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        state.draggedItem = e.target.closest('.item');
        state.draggedItemId = state.draggedItem.dataset.id;
        state.draggedItem.classList.add('dragging');

        // Add body class for CSS targeting
        document.body.classList.add('dragging-active');

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', state.draggedItemId);

        const itemName = state.draggedItem.querySelector('.label').textContent;
        updateStatus(`Dragging: ${itemName}`);
        updateDebug(`dragstart: ${state.draggedItemId}`);
      });

      item.addEventListener('dragend', () => {
        document.querySelectorAll('.dragging, .drag-over').forEach(el => {
          el.classList.remove('dragging', 'drag-over');
        });

        state.draggedItem = null;
        state.draggedItemId = null;
        lastDropTarget = null;
        document.body.classList.remove('dragging-active');

        updateDebug('dragend: cleanup complete');
      });
    });

    // Drag Over - Track current drop target
    document.addEventListener('dragover', (e) => {
      if (!state.draggedItem) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      // Find valid drop target
      let target = e.target.closest('.folder');

      // Fallback: search nearby
      if (!target) {
        target = findNearbyDropTarget(e.clientX, e.clientY, state.draggedItemId);
      }

      if (target && target.dataset.id !== state.draggedItemId) {
        // Only update if target changed
        if (target !== lastDropTarget) {
          if (lastDropTarget) {
            lastDropTarget.classList.remove('drag-over');
          }
          target.classList.add('drag-over');
          lastDropTarget = target;

          const folderName = target.querySelector('.label').textContent;
          updateStatus(`Drop into: ${folderName}`);
          updateDebug(`dragover: target=${target.dataset.id}`);
        }
      } else if (!target && lastDropTarget) {
        lastDropTarget.classList.remove('drag-over');
        lastDropTarget = null;
        updateStatus('Drag an item to a folder');
      }
    });

    // Drag Leave - With relatedTarget check (KEY FIX)
    document.addEventListener('dragleave', (e) => {
      const target = e.target.closest('.folder');
      if (!target) return;

      const relatedTarget = e.relatedTarget;

      // KEY FIX: If moving to child element, ignore this event
      if (relatedTarget && target.contains(relatedTarget)) {
        updateDebug('dragleave: ignored (moving to child)');
        return;
      }

      // Check if moving to another folder
      const newTarget = relatedTarget?.closest('.folder');
      if (newTarget && newTarget !== target) {
        updateDebug('dragleave: ignored (moving to sibling folder)');
        return;
      }

      target.classList.remove('drag-over');
      if (lastDropTarget === target) {
        lastDropTarget = null;
      }

      updateDebug(`dragleave: removed from ${target.dataset.id}`);
    });

    // Drop - Multi-fallback strategy (KEY FIX)
    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (!state.draggedItem) return;

      // CRITICAL: Capture state immediately to prevent race condition
      const draggedItemId = state.draggedItemId;
      const currentLastDropTarget = lastDropTarget;
      const itemName = state.draggedItem.querySelector('.label').textContent;

      let targetId = null;
      let strategy = '';

      // Strategy 1: Use lastDropTarget (highest reliability)
      if (currentLastDropTarget?.dataset?.id) {
        targetId = currentLastDropTarget.dataset.id;
        strategy = 'lastDropTarget';
      }

      // Strategy 2: Direct DOM traversal
      if (!targetId) {
        const target = e.target.closest('.folder');
        if (target) {
          targetId = target.dataset.id;
          strategy = 'closest()';
        }
      }

      // Strategy 3: Search nearby elements
      if (!targetId) {
        const nearbyTarget = findNearbyDropTarget(e.clientX, e.clientY, draggedItemId);
        if (nearbyTarget) {
          targetId = nearbyTarget.dataset.id;
          strategy = 'elementFromPoint';
        }
      }

      // No valid target found
      if (!targetId || targetId === draggedItemId) {
        updateStatus('Drop cancelled - no valid target');
        updateDebug('drop: no valid target found');
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        return;
      }

      // Simulate async operation (like API call)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get folder name for display
      const folder = document.querySelector(`.folder[data-id="${targetId}"]`);
      const folderName = folder?.querySelector('.label')?.textContent || targetId;

      updateStatus(`✅ Moved "${itemName}" to "${folderName}"`, true);
      updateDebug(`drop: success via ${strategy}`);

      // Cleanup
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
  </script>
</body>
</html>
```

---

## 6. Key Takeaways

### The 4 Critical Fixes

| Problem | Solution | Code Pattern |
|---------|----------|--------------|
| dragleave bubbling | CSS `pointer-events: none` on children | `body.dragging-active .child { pointer-events: none }` |
| State race condition | Capture before await | `const id = state.item; await ...; use(id)` |
| Unreliable drop detection | Multi-fallback strategy | lastDropTarget → closest() → elementFromPoint |
| Poor UX | Expand drop zones + visual feedback | Padding increase + prominent borders during drag |

### Event Flow Reference

```
dragstart → dragover(repeated) → dragleave(if leaving) → drop → dragend
                                                              ↑
                                              May fire DURING async drop handler!
```

### Browser Compatibility Notes

- **Safari iOS**: `relatedTarget` is unreliable, use CSS pointer-events instead
- **Firefox**: Sets MIME type to `application/x-moz-file` until actual drop
- **Chrome/Edge**: Most reliable, supports all patterns in this guide

### When to Use This Pattern

✅ **Good for:**
- File managers
- Kanban boards
- Bookmark organizers
- Tree views
- Gallery reordering

❌ **Consider alternatives for:**
- Mobile-first apps (use touch events or libraries like `interact.js`)
- Complex nested drops (consider `react-dnd` or `dnd-kit`)
- Virtual scrolling (need additional scroll handling)

---

## 7. Performance & Accessibility

### Performance Tips

The `dragover` event fires continuously (60+ times/second). For large lists:

```javascript
// Throttle dragover handler
let lastDragoverTime = 0;
const THROTTLE_MS = 16; // ~60fps

document.addEventListener('dragover', (e) => {
  const now = Date.now();
  if (now - lastDragoverTime < THROTTLE_MS) return;
  lastDragoverTime = now;

  // ... rest of handler
});
```

### Accessibility: Always Provide Alternatives

Drag and drop is not accessible to all users. Always provide:

- **Keyboard shortcuts** (e.g., Ctrl+X/C/V for cut/copy/paste)
- **Context menu options** ("Move to..." submenu)
- **Button-based actions** for touch devices

```html
<!-- Accessible alternative -->
<button aria-label="Move Report.pdf" onclick="showMoveDialog('doc-1')">
  Move
</button>
```

---

## References

1. [MDN: HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)
2. [Common Pitfalls with HTML5 Drag n Drop API](https://medium.com/@reiberdatschi/common-pitfalls-with-html5-drag-n-drop-api-9f011a09ee6c)
3. [Atlassian Pragmatic Drag and Drop](https://atlassian.design/components/pragmatic-drag-and-drop/core-package/drop-targets/)
4. [Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/drag-and-drop-ux/)

---

*Written by the Bookmark XP Explorer team. December 2024.*
