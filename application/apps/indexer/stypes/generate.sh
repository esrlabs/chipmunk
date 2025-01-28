#!/bin/bash

echo "
This script generates TypeScript types from Rust types by executing special unit tests.
After running these tests, the types will be generated, and existing types will be overwritten
in the 'application/platform/types' directory.

Notes:
* Please commit only the new changes and exclude the overwritten versions of existing types.
"
read -p "Do you want to continue? (y/N): " response

response=${response,,}
if [[ "$response" != "y" ]]; then
  echo "Operation aborted."
  exit 1
fi

echo "Generating types"
cargo test --release --features "test_and_gen" -- --nocapture
