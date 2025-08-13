#!/bin/bash

# Build docker image using current user infos.

set -e

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)

REPO_ROOT=$(dirname "$(dirname "$SCRIPT_DIR")")

docker build \
  --build-arg USER_ID=$(id -u) \
  --build-arg GROUP_ID=$(id -g) \
  -t ubuntu2004 \
  -f "$SCRIPT_DIR/Dockerfile" \
  "$REPO_ROOT" # Set the build context to the repository root
