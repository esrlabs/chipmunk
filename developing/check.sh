#!/bin/bash
ERRORS=0;
if ruby -v &>/dev/null; then
    echo "ruby is OK"
else
    ERRORS=1;
    echo "ruby is missed.";
fi
if node -v &>/dev/null; then
    echo "NodeJS is OK"
else
    ERRORS=1;
    echo "NodeJS is missed.";
fi
if npm -v &>/dev/null; then
    echo "npm is OK"
else
    ERRORS=1;
    echo "npm is missed.";
fi
if rustup -V &>/dev/null; then
    echo "rust is OK"
else
    ERRORS=1;
    echo "rust is missed.";
fi
if cargo -V &>/dev/null; then
    echo "cargo is OK"
else
    ERRORS=1;
    echo "cargo is missed.";
fi
if wasm-pack --help &>/dev/null; then
    echo "wasm-pack is OK"
else
    ERRORS=1;
    echo "wasm-pack is missed. (cargo install wasm-pack)";
fi
if nj-cli -V &>/dev/null; then
    echo "nj-cli is OK"
else
    ERRORS=1;
    echo "nj-cli is missed. (cargo install nj-cli)";
fi
if (($ERRORS>0)); then
    exit 1
else
    echo "all good"
fi