#!/bin/bash

# This script runs the unit tests for each feature separated because it's still not
# possible to define default features for test profile separately.

# Current available feature for plugins
features=("parser" "bytesource")

# Run tests for each feature
for feature in "${features[@]}"; do
  echo "Testing feature: $feature with additional arguments: $@"
  cargo test --features $feature "$@"
  echo "---------------------------------------------------"
done
