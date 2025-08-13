#!/bin/bash

# Run docker container using its default command (release for ubuntu 20.04).

set -e

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)

REPO_ROOT=$(dirname "$(dirname "$SCRIPT_DIR")")

docker run --rm \
  -v "$REPO_ROOT":/home/appuser/chipmunk:rw \
  ubuntu2004 \
  "$@"
