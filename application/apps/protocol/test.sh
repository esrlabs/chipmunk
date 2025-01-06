#!/bin/bash

reset
echo "
====== WARNING ===============================================================
This script performs an operation to DELETE ALL the contents of 
the folder specified in the environment variable CHIPMUNK_PROTOCOL_TEST_OUTPUT.
Before proceeding, make sure that the CHIPMUNK_PROTOCOL_TEST_OUTPUT variable
contains the correct path. If the CHIPMUNK_PROTOCOL_TEST_OUTPUT variable is
not defined, test data will be written to /\$TMP/stypes_tests.
====== WARNING ===============================================================
"
read -p "Do you want to continue? (y/N): " response

response=${response,,} 
if [[ "$response" != "y" ]]; then
    echo "Operation aborted."
    exit 1
fi

echo "Build wasm module"
cargo clean
wasm-pack build --target nodejs

echo "Create test use-cases"
cd ../indexer/stypes
export CHIPMUNK_PROTOCOL_TEST_OUTPUT="/tmp/stypes_test/"
cargo test --release --features "test_and_gen" -- --nocapture --ignored

echo "Run tests"
export JASMIN_TEST_BLOCKS_LOGS=on
cd ../../rustcore/ts-bindings
rm -rf ./node_modules
rm -rf ./spec/build
rake bindings:test:protocol
 