#!/bin/bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# The Vite + @crxjs output is the loadable unpacked extension.
PACKAGE_DIR="$ROOT_DIR/build"

# Load environment variables from .env file if it exists
if [ -f "$ROOT_DIR/.env" ]; then
    source "$ROOT_DIR/.env"
fi

# Ensure TARGET_DIR is configured
if [ -z "$WINDOWS_ARTIFACTS_PATH" ]; then
    echo "Error: WINDOWS_ARTIFACTS_PATH is not defined in .env."
    echo "Please configure it inside your .env file. E.g.:"
    echo "WINDOWS_ARTIFACTS_PATH=\"/mnt/c/path/to/chrome-widemark-dist\""
    exit 1
fi

TARGET_DIR="$WINDOWS_ARTIFACTS_PATH"
TARGET_PARENT="$(dirname "$TARGET_DIR")"

echo "Starting Windows sync hook (sync-to-windows)..."
echo "Package directory: $PACKAGE_DIR"
echo "Target directory: $TARGET_DIR"

if [ ! -d "$PACKAGE_DIR" ]; then
    echo "Error: Package directory $PACKAGE_DIR does not exist."
    echo "Run npm run build before syncing."
    exit 1
fi

PACKAGE_ZIP="$(find "$ROOT_DIR/dist" -maxdepth 1 -type f -name 'widemark-v*.zip' | sort | tail -n 1)"

mkdir -p "$TARGET_DIR"

if [ $? -ne 0 ]; then
    echo "Error: Failed to create target directory $TARGET_DIR"
    exit 1
fi

# Remove files from older builds before copying the current packaged extension.
find "$TARGET_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

cp -r "$PACKAGE_DIR"/. "$TARGET_DIR"/
echo "Copied packaged extension contents to $TARGET_DIR/"

if [ -n "$PACKAGE_ZIP" ]; then
    cp "$PACKAGE_ZIP" "$TARGET_PARENT/"
    echo "Copied package zip to $TARGET_PARENT/$(basename "$PACKAGE_ZIP")"
else
    echo "Warning: Package zip not found, skipping zip sync."
fi

echo "Windows sync hook finished successfully!"
