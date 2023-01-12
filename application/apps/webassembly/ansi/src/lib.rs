extern crate ansi_to_html;
extern crate strip_ansi_escapes;
extern crate wasm_bindgen;

use std::str;
use strip_ansi_escapes::strip;
use wasm_bindgen::prelude::*;
use wasm_bindgen_test::*;

#[wasm_bindgen]
pub fn convert(input: &str) -> Result<String, String> {
    ansi_to_html::convert(input, false, false).map_err(|e| format!("{e}"))
}

#[wasm_bindgen]
pub fn escape(input: &str) -> Result<String, String> {
    let bytes = input.as_bytes();
    let plain_bytes = strip(bytes).map_err(|e| format!("{e}"))?;
    Ok(str::from_utf8(&plain_bytes)
        .map_err(|e| format!("{e}"))?
        .to_owned())
}

#[wasm_bindgen_test]
fn converting() {
    assert_eq!(
        convert("<h1> \x1b[1m Hello \x1b[31m world! </h1>")
            .expect("Input string should be converted as well")
            .as_str(),
        "<h1> <b> Hello <span style='color:#a00'> world! </h1></span></b>"
    );
}

#[wasm_bindgen_test]
fn error_handaling() {
    assert!(
        convert("[38;3;43m01-23 10:01:29.103  2116  2710 I chatty  : uid=1000(system) Binder:2116_4 expire 4 lines[0m").is_err()
    );
}

#[wasm_bindgen_test]
fn escapeing() {
    assert_eq!(
        escape("[38;3;43m01-23 10:01:29.103  2116  2710 I chatty  : uid=1000(system) Binder:2116_4 expire 4 lines[0m")
            .expect("Input string should be escaped as well")
            .as_str(),
            "01-23 10:01:29.103  2116  2710 I chatty  : uid=1000(system) Binder:2116_4 expire 4 lines"
    );
}
