# Use PowerShell for recipes on Windows.
set windows-shell := ["powershell", "-c"]

python := if os_family() == "windows" { "python" } else { "python3" }

alias f := fmt-check
alias pr := validate
alias v := validate

# Show available recipes when running `just` without arguments.
default:
    @just --list

# Run the full local validation suite.
validate: fmt-check check clippy test

# Compile all workspace targets without producing final binaries.
check:
    cargo check --workspace --all-targets --all-features --locked

# Run Clippy on all workspace targets and fail on warnings.
clippy:
    cargo clippy --workspace --all-targets --all-features --locked -- -D warnings

# Run workspace tests without benchmark targets.
test:
    cargo test --workspace --all-features --locked

# Check Rust formatting without changing files.
fmt-check:
    cargo fmt --all -- --check

# Format Rust code in the workspace.
fmt:
    cargo fmt --all

# Run the native app. Pass Cargo/app args after the recipe: `just run -r -- file ...`.
run *args:
    cargo run -p chipmunk-app --locked {{ args }}

# Install the native app binary with Cargo.
install-app:
    cargo install --path crates/chipmunk-app --locked

# Install the Chipmunk CLI with Cargo.
install-cli:
    cargo install --path crates/chipmunk-cli --locked

# Remove release artifacts.
clean-dist:
    rm -rf target/dist

# Remove Cargo build outputs and release artifacts.
clean: clean-dist
    cargo clean

# Build and package a local release artifact.
release:
    {{ python }} development/scripts/release_app.py

# Build, package, sign, notarize, and staple the macOS release when env vars are set.
release-signed:
    {{ python }} development/scripts/release_app.py --code-sign
