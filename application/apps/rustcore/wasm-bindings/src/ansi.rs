extern crate ansi_to_html;
extern crate strip_ansi_escapes;
extern crate wasm_bindgen;

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::str;
use strip_ansi_escapes::strip_str;
use wasm_bindgen::prelude::*;
use wasm_bindgen_test::*;

#[wasm_bindgen]
pub fn convert(input: &str) -> Result<String, String> {
    ansi_to_html::convert(input).map_err(|e| e.to_string())
}

#[wasm_bindgen]
pub fn escape(input: &str) -> Result<String, String> {
    Ok(strip_str(input))
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Slot {
    pub from: usize,
    pub to: usize,
    pub color: Option<String>,
    pub background: Option<String>,
    pub bold: bool,
    pub italic: bool,
}
impl Slot {
    pub fn new(from: usize, to: usize, tag: String, mapper: &AnsiMapper) -> Self {
        Slot {
            from,
            to,
            color: mapper.get_color(&tag),
            background: mapper.get_background(&tag),
            bold: tag.starts_with("<b"),
            italic: tag.starts_with("<i"),
        }
    }
    pub fn is_same(&self, from: &usize, to: &usize) -> bool {
        &self.from == from && &self.to == to
    }
}

#[wasm_bindgen]
pub struct AnsiMapper {
    color: Regex,
    background: Regex,
}

#[wasm_bindgen]
impl AnsiMapper {
    #[wasm_bindgen]
    pub fn new() -> Result<AnsiMapper, String> {
        Ok(AnsiMapper {
            color: Regex::new(r"color:[^>]*?(#[\d\w]{1,})").map_err(|e| e.to_string())?,
            background: Regex::new(r"background:[^>]*?(#[\d\w]{1,})").map_err(|e| e.to_string())?,
        })
    }
    #[wasm_bindgen]
    pub fn get_map(&self, input: &str) -> Result<JsValue, String> {
        let map = self.create_map(&convert(input)?)?;
        serde_wasm_bindgen::to_value(&map).map_err(|e| e.to_string())
    }

    pub fn get_color(&self, input: &str) -> Option<String> {
        self.color.captures(input).map(|captures| {
            if let Some(s) = captures.get(1) {
                s.as_str().to_owned()
            } else {
                String::new()
            }
        })
    }

    pub fn get_background(&self, input: &str) -> Option<String> {
        self.background.captures(input).map(|captures| {
            if let Some(s) = captures.get(1) {
                s.as_str().to_owned()
            } else {
                String::new()
            }
        })
    }

    fn create_map(&self, input: &str) -> Result<Vec<Slot>, String> {
        let mut map: Vec<(usize, usize, String)> = Vec::new();
        let mut slots: Vec<Slot> = Vec::new();
        let mut stack = Vec::new();
        let mut clean_length = 0;
        let mut i = 0;
        while i < input.len() {
            // call of input[i..] unfriendly to Unicode, so we should make sure we are
            // taking completed sequences
            let Some(current) = input.get(i..) else {
                clean_length += 1;
                i += 1;
                continue;
            };
            if input[i..].starts_with('<') && !input[i..].starts_with("</") {
                if let Some(pos) = current.find('>') {
                    let tag = &current[..=pos];
                    stack.push((clean_length, tag.to_string()));
                    i += tag.len();
                } else {
                    return Err(String::from("Fail to find closing \">\" on opening tag"));
                }
            } else if input[i..].starts_with("</") {
                if let Some(pos) = current.find('>') {
                    let tag = &current[..=pos];
                    if let Some((start, tag)) = stack.pop() {
                        map.push((start, clean_length, tag));
                    }
                    i += tag.len();
                } else {
                    return Err(String::from("Fail to find closing \">\" on closing tag"));
                }
            } else {
                clean_length += 1;
                i += 1;
            }
        }
        for (from, to, _tag) in map.iter() {
            if slots.iter().any(|s| s.is_same(from, to)) {
                continue;
            }
            let tag = map
                .iter()
                .filter_map(|(start, end, tag)| {
                    if start == from && end == to {
                        Some(tag)
                    } else {
                        None
                    }
                })
                .map(|s| s.as_str())
                .collect::<Vec<&str>>()
                .join("|");
            slots.push(Slot::new(*from, *to, tag, self))
        }
        Ok(slots)
    }
}

#[allow(dead_code)]
#[wasm_bindgen_test]
fn converting() {
    assert_eq!(
        convert("<h1> \x1b[1m Hello \x1b[31m world! </h1>")
            .expect("Input string should be converted as well")
            .as_str(),
        "&lt;h1&gt; <b> Hello <span style='color:var(--red,#a00)'> world! &lt;/h1&gt;</span></b>"
    );
}

#[allow(dead_code)]
#[wasm_bindgen_test]
fn error_handling() {
    assert!(
        convert("[38;3;43m01-23 10:01:29.103  2116  2710 I chatty  : uid=1000(system) Binder:2116_4 expire 4 lines[0m").is_err()
    );
}

#[allow(dead_code)]
#[wasm_bindgen_test]
fn escaping() {
    assert_eq!(
        escape("[38;3;43m01-23 10:01:29.103  2116  2710 I chatty  : uid=1000(system) Binder:2116_4 expire 4 lines[0m")
            .expect("Input string should be escaped as well")
            .as_str(),
            "01-23 10:01:29.103  2116  2710 I chatty  : uid=1000(system) Binder:2116_4 expire 4 lines"
    );
}

#[test]
fn creating_map() {
    let mapper = AnsiMapper::new().expect("Asci mapper should be created");
    let cases = [
        ("[35;5;40m01-23 10:01:25.642  2116  2711 I chatty  : uid=1000(system) Binder:2116_5 expire 5 lines[0m", 0, 88),
        ("[35;5;40m01-23 10:01:25.642[0m  2116  2711 I chatty  : uid=1000(system) Binder:2116_5 expire 5 lines", 0, 18),
        ("01-23 10:01:25.[35;5;40m642[0m  2116  2711 I chatty  : uid=1000(system) Binder:2116_5 expire 5 lines", 15, 18),
        ("01-23 10:01:25.642  2116  2711 I chatty  : uid=1000(system) Binder:2116_5 expire 5 [35;5;40mlines[0m", 83, 88),
    ];
    cases.iter().for_each(|(content, from, to)| {
        let converted = convert(content).expect("Input string should be parsed as well");
        let map = mapper.create_map(&converted).expect("Map should be built");
        assert_eq!(map.len(), 1);
        assert_eq!(&map[0].from, from);
        assert_eq!(&map[0].to, to);
        assert_eq!(map[0].color, Some(String::from("#a0a")));
        assert_eq!(map[0].background, Some(String::from("#000")));
    });
    let cases = [
        ("[38;5;40m01-23 16:59:19.469  2116  5211 I chatty  : uid=1000(system) Binder:2116_17 expire 2 lines[0m", 0, 89)
    ];
    cases.iter().for_each(|(content, from, to)| {
        let converted = convert(content).expect("Input string should be parsed as well");
        let map = mapper.create_map(&converted).expect("Map should be built");
        assert_eq!(map.len(), 1);
        assert_eq!(&map[0].from, from);
        assert_eq!(&map[0].to, to);
        assert!(map[0].color.is_some());
        assert!(map[0].background.is_none());
    });
    let cases = [
        ("[35;5;40mlines[0m01-23 10:01:25.642  2116  2711 I [35;5;40mlines[0mchatty  : uid=1000(system) Binder:2116_5 expire 5 [35;5;40mlines[0m", 3),
        ("[36;5;40mlines[0m[35;5;40mlines[0m[36;5;40mlines[0m01-23 10:01:25.642  2116  2711 I chatty  : uid=1000(system) Binder:2116_5 expire 5 [35;5;40mlines[0m", 4),
        ("[35;5;40mlines[0m01-23 10:01:25.642  [35;5;40mlines[0m2116  2711 I [35;5;40mlines[0mchatty  : uid=1000(system) Binder:2116_5 expire 5 [35;5;40mlines[0m", 4),
    ];
    cases.iter().for_each(|(content, count)| {
        let converted = convert(content).expect("Input string should be parsed as well");
        let map = mapper.create_map(&converted).expect("Map should be built");
        assert_eq!(&map.len(), count);
    });
}
