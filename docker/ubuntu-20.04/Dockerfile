# Docker file to build chipmunk release in ubuntu-20.04 after it lost support 
# on GitHub Actions.
#
# Building the image must run form the repo root with specifying the path for the 
# docker file and providing the user and group ID for the current user.  
# Note: The current user can't be root.
#
# Build example (pwd is chipmunk repo root):
#   docker build \
#          --build-arg USER_ID=$(id -u) \
#          --build-arg GROUP_ID=$(id -g) \
#          -t ubuntu2004 \
#          -f docker/ubuntu-20.04/Dockerfile\
#          .
#
# Running the container require mounting the root with read and write access to 
# the directory 'chipmunk' in docker image root.
#
# Run example for release (pwd is chipmunk repo root):
#   docker run -v .:/chipmunk:rw ubuntu2004 
#
# Run example for interactive session (pwd is chipmunk repo root):
#   docker run --rm -it -v .:/chipmunk:rw ubuntu2004 bash

FROM ubuntu:20.04

ARG DEBIAN_FRONTEND=noninteractive

# --- USER SETUP ---
# Mandatory Arguments for user and group IDs.
# Note: User can't be root user.
# Example: 
#   docker build --build-arg USER_ID=$(id -u) --build-arg GROUP_ID=$(id -g) ...
ARG USER_ID
ARG GROUP_ID
RUN if [ -z "$USER_ID" ] || [ "$USER_ID" -eq 0 ] || [ -z "$GROUP_ID" ] || [ "$GROUP_ID" -eq 0 ]; then \
  echo "Error: USER_ID and GROUP_ID are mandatory and must not be 0 (root)." >&2; \
  exit 1; \
  fi
RUN addgroup --gid $GROUP_ID app && \
  adduser --uid $USER_ID --ingroup app --disabled-password --gecos '' appuser

# --- Dependencies ---
# Packages needed:
# - curl & gnupg: Node installation
# - build-essential: Rust 
# - libudev-dev & pkg-config: Chipmunk 
# - git: Chipmunk Dev CLI
RUN apt-get update && \
  apt-get install -y curl gnupg libudev-dev build-essential pkg-config git && \
  # Add Node.js from source 
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
  apt-get install -y nodejs && \
  # Clean up
  rm -rf /var/lib/apt/lists/*

# Enable yarn
RUN corepack enable && yarn cache clean

USER appuser

# Install Rust
ENV PATH="/home/appuser/.cargo/bin:${PATH}"
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
RUN rustup target add wasm32-unknown-unknown

# Rust tools
RUN cargo install nj-cli wasm-pack

# Development CLI tool
COPY --chown=appuser:app cli/development-cli /home/appuser/dev-cli
RUN cargo install --path /home/appuser/dev-cli

# Setup Git Configurations (Needed for Dev CLI)
RUN git config --global user.name "user" && \
  git config --global user.email "user@user" && \
  git config --global safe.directory "*"

# We expect the repo to be mounted to the directory `/home/appuser/chipmunk`
WORKDIR /home/appuser/chipmunk

CMD ["cargo", "chipmunk", "release", "-p", "ubuntu-20.04"]
