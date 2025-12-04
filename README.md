# Bookmark XP Explorer

A Chrome extension that brings the nostalgic Windows XP Explorer interface to bookmark management, featuring a modern Liquid Glass theme.

## Features

- **Classic Windows XP Look** - Familiar folder tree navigation with address bar
- **Liquid Glass Theme** - Modern, translucent design with smooth animations
- **Split View Mode** - View and organize two folders side-by-side
- **Full Bookmark Management** - Create, rename, delete, drag-and-drop
- **Keyboard Shortcuts** - `Ctrl+Shift+B` / `Cmd+Shift+B` for full-page mode
- **Privacy Focused** - No data collection, everything stays local

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation (Developer Mode)
1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked" and select the project folder
5. The extension will appear in your toolbar

## Usage

- **Popup Mode**: Click the extension icon for quick access
- **Full-Page Mode**: Press `Ctrl+Shift+B` (Mac: `Cmd+Shift+B`) or click the expand button
- **Split View**: Toggle in full-page mode to view two folders simultaneously
- **Organize**: Drag and drop bookmarks between folders

## Development

No build step required - this is a vanilla JavaScript extension.

```bash
# Make changes to source files
# Reload extension in chrome://extensions
# Test your changes
```

### Building for Chrome Web Store

```bash
chmod +x scripts/build-zip.sh
./scripts/build-zip.sh
```

The ZIP file will be created in the `dist/` directory.

## Project Structure

```
bookmark-xp-explorer/
├── manifest.json       # Extension configuration
├── background/         # Service worker
├── popup/              # Browser action popup
├── fullpage/           # Full-page mode with split view
├── icons/              # Extension icons
├── store/              # Chrome Web Store assets
└── scripts/            # Build scripts
```

## Privacy

This extension does not collect any data. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for details.

## License

MIT
