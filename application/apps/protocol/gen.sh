#!/bin/bash
set -e

# Remove previous version
rm -rf ./wasm/pkg
rm -rf ./wasm/target
rm -rf ./proto/output
rm -rf ../rustcore/ts-bindings/src/protocol
mkdir ../rustcore/ts-bindings/src/protocol

# Generate proto TS definitions
export TSLINK_BUILD=true
cd ./proto
cargo clean
cargo build
export TSLINK_BUILD=false
cd ..

# Copy generated TS definitions
cp -r ./proto/output/* ../rustcore/ts-bindings/src/protocol

# Create WASM module
cd ./wasm
wasm-pack build --target nodejs


