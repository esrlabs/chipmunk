FROM ubuntu:20.04

ARG DEBIAN_FRONTEND=noninteractive

# Packages needed:
# - curl & gnupg: Node installation
# - build-essential: Rust 
# - libudev-dev & pkg-config: Chipmunk 
# - git: Chipmunk Dev CLI
RUN apt-get update && \
  apt-get install -y curl gnupg libudev-dev build-essential pkg-config git&& \
  rm -rf /var/lib/apt/lists/*

### Node ###
# Add & Install latest node.
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
RUN apt-get install -y nodejs

# Enable yarn
RUN corepack enable && yarn cache clean

### Rust ###
ENV PATH="/root/.cargo/bin:${PATH}"
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# WASM is needed for wasm-pack at runtime
RUN rustup target add wasm32-unknown-unknown

# Rust tools
RUN cargo install nj-cli wasm-pack

# Development CLI tool
RUN --mount=type=bind,source=cli/development-cli,target=/dev-cli,rw \
  cargo install --path /dev-cli

# Setup Git Configurations (Needed for Dev CLI)
RUN git config --global user.name "user" && \
  git config --global user.email "user@user" && \
  git config --global safe.directory "*"

# We expect the repo to be mounted to the directory `/chipmunk`
WORKDIR /chipmunk

# This will run the release setting output in `application/holder/release`
# To run the image: `docker run -v .:/chipmunk:rw chipmunk`
CMD ["cargo", "chipmunk", "release"]
