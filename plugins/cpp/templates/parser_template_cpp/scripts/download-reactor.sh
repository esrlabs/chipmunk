#!/bin/sh
#
# Script to download WASI reactor file.
#
# Usage: ./scripts/download-reactor.sh <destination_path>

# Fail fast on errors.
set -e

URL="https://github.com/bytecodealliance/wasmtime/releases/download/dev/wasi_snapshot_preview1.reactor.wasm"
DEST_FILE="$1" # The destination path is passed as the first argument

if [ -z "$DEST_FILE" ]; then
  echo "Error: No destination file path provided."
  echo "Usage: $0 <destination_path>"
  exit 1
fi

# Ensure the vendor directory exists
DEST_DIR=$(dirname "$DEST_FILE")
mkdir -p "$DEST_DIR"

# Download the file
echo "Downloading WASI reactor to: $DEST_FILE"
curl --fail --location --output "$DEST_FILE" "$URL"
echo "Download complete."
