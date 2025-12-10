#!/bin/bash

# Build script for Chrome Web Store submission
# Creates a ZIP file of the extension

set -e

# Configuration
EXTENSION_NAME="bookmark-xp-explorer"
VERSION=$(grep '"version"' manifest.json | sed 's/.*: "\(.*\)".*/\1/')
OUTPUT_DIR="dist"
ZIP_NAME="${EXTENSION_NAME}-v${VERSION}.zip"

echo "Building ${EXTENSION_NAME} v${VERSION}..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Remove old zip if exists
rm -f "${OUTPUT_DIR}/${ZIP_NAME}"

# Create ZIP excluding unnecessary files
zip -r "${OUTPUT_DIR}/${ZIP_NAME}" . \
  -x "*.git*" \
  -x "*.idea*" \
  -x "*node_modules*" \
  -x "*.DS_Store" \
  -x "dist/*" \
  -x "store/*" \
  -x "scripts/*" \
  -x "*.md" \
  -x "*.sh" \
  -x "*.zip" \
  -x "tests/*" \
  -x "playwright.config.js" \
  -x "playwright-report/*" \
  -x "test-results/*" \
  -x "package.json" \
  -x "pnpm-lock.yaml" \
  -x ".prettierrc" \
  -x ".prettierignore" \
  -x "eslint.config.js" \
  -x ".serena/*" \
  -x ".husky/*" \
  -x ".playwright-mcp/*" \
  -x ".qodo/*" \
  -x "PROJECT_INDEX.json" \
  -x "{popup,background,icons}/*"

echo ""
echo "Created: ${OUTPUT_DIR}/${ZIP_NAME}"
echo ""

# Show ZIP contents
echo "ZIP contents:"
unzip -l "${OUTPUT_DIR}/${ZIP_NAME}"

echo ""
echo "File size: $(du -h "${OUTPUT_DIR}/${ZIP_NAME}" | cut -f1)"
echo ""
echo "Ready for Chrome Web Store upload!"
