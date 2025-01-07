#!/bin/bash

echo "
This script generates TypeScript types from Rust types by executing special unit tests.
After running these tests, the types will be generated, and existing types will be overwritten
in the 'bindings' directory.
Please copy only the newly generated types to the 'application/platform/types' directory.

Notes:
* The generated files in 'bindings' are not part of the communication protocol; only the types in
  'platform' are part of the protocol.
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
