#!/bin/bash

# This script generate the tests in matching conditions to the specification inside
# `Cargo.toml` file to match the generated docs on `docs.rs` once the crate is published
#
# * We add the flag `docsrs` that is available on nightly rust to get the hint about which
#   type is available with which feature.
#
# * `all-features` flag to generate the documentation for the all available features.
#
# * `no-deps` and `workspace` to build docs for the libs defined in workspace only without
#   their external dependencies

RUSTDOCFLAGS="--cfg docsrs" cargo +nightly doc --no-deps --workspace --all-features --open
