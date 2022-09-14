extern crate ansi_to_html;
extern crate wasm_bindgen;

use wasm_bindgen::prelude::*;
use wasm_bindgen_test::*;

#[wasm_bindgen]
pub fn convert(input: &str) -> Result<String, String> {
    ansi_to_html::convert(input, false, false).map_err(|e| format!("{}", e))
}

#[wasm_bindgen_test]
fn converting() {
    assert_eq!(
        convert("<h1> \x1b[1m Hello \x1b[31m world! </h1>")
            .unwrap()
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
