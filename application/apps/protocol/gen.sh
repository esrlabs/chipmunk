#!/bin/bash
# TypeScript
../../../../../../flatbuffers/flatc --ts -o output/binding/ts -I include ./binding.fbs $(find ./binding -name '*.fbs')
# Rust
../../../../../../flatbuffers/flatc --rust -o output/binding/rust -I include ./binding.fbs $(find ./binding -name '*.fbs')