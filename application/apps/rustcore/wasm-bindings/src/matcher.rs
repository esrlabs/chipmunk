extern crate fuzzy_matcher;
extern crate serde_json;
extern crate wasm_bindgen;

use fuzzy_matcher::{skim::SkimMatcherV2, FuzzyMatcher};
use std::{collections::HashMap, str::from_utf8};
use wasm_bindgen::prelude::*;
use wasm_bindgen_test::*;

#[wasm_bindgen]
pub struct Matcher {
    matcher: SkimMatcherV2,
    items_initial: Vec<HashMap<String, String>>,
    items_scored: HashMap<usize, (HashMap<String, String>, i64)>,
}

impl Default for Matcher {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl Matcher {
    #[wasm_bindgen]
    pub fn new() -> Self {
        Self {
            matcher: SkimMatcherV2::default(),
            items_initial: Vec::new(),
            items_scored: HashMap::new(),
        }
    }

    #[wasm_bindgen]
    pub fn set_item(&mut self, item: String) -> Result<usize, String> {
        match serde_json::from_str(&item) {
            Ok::<HashMap<String, String>, _>(item) => {
                self.items_initial.push(item);
                self.search(String::new(), None);
                Ok(self.items_initial.len() - 1)
            }
            Err(err) => Err(format!("Parsing item into JSON String failed: {}", err)),
        }
    }

    #[wasm_bindgen]
    pub fn set_items(&mut self, items: String) -> Result<usize, String> {
        match serde_json::from_str(&items) {
            Ok::<Vec<HashMap<String, String>>, _>(mut items) => {
                let from = self.items_initial.len();
                self.items_initial.append(&mut items);
                self.search(String::new(), None);
                Ok(from)
            }
            Err(err) => Err(format!("Parsing item into JSON String failed: {}", err)),
        }
    }

    #[wasm_bindgen]
    pub fn len(&self) -> usize {
        self.items_initial.len()
    }

    #[wasm_bindgen]
    pub fn is_empty(&self) -> bool {
        self.items_initial.is_empty()
    }

    #[wasm_bindgen]
    pub fn search(&mut self, query: String, tag: Option<String>) {
        self.items_scored = HashMap::new();
        let mut total_score: i64;
        let mut temp_hashmap: HashMap<String, String> = HashMap::new();
        for (index, item) in self.items_initial.iter().enumerate() {
            total_score = 0;
            for (key, value) in item {
                if query.is_empty() {
                    temp_hashmap.insert(key.clone(), value.clone());
                    temp_hashmap.insert(format!("html_{}", key), value.to_string());
                    total_score += (self.items_initial.len() - index) as i64;
                } else {
                    match self.matcher.fuzzy_indices(value.as_str(), &query) {
                        Some(score) => {
                            let tagged_match = self.tag_match(value.to_owned(), score.1, &tag);
                            temp_hashmap.insert(key.clone(), value.to_owned());
                            temp_hashmap.insert(format!("html_{}", key), tagged_match);
                            total_score += score.0;
                        }
                        None => {
                            temp_hashmap.insert(key.clone(), value.clone());
                            temp_hashmap.insert(format!("html_{}", key), value.to_string());
                        }
                    }
                }
            }
            self.items_scored
                .insert(index, (temp_hashmap.to_owned(), total_score));
            temp_hashmap.clear();
        }
    }

    #[wasm_bindgen]
    pub fn get_html_of(&self, index: usize, property: String) -> Option<String> {
        match self.items_scored.get(&index) {
            Some(item) => item
                .0
                .get(&property)
                .as_ref()
                .map(|html_value| html_value.to_string()),
            None => None,
        }
    }

    #[wasm_bindgen]
    pub fn get_score(&self, index: usize) -> i64 {
        match self.items_scored.get(&index) {
            Some(item) => item.1,
            None => 0,
        }
    }

    fn tag_match(&self, mut value: String, indexes: Vec<usize>, tag: &Option<String>) -> String {
        let tag = tag.to_owned().unwrap_or_else(|| "span".to_string());
        let op_tag = format!("<{}>", tag);
        let ed_tag = format!("</{}>", tag);
        let value_clone = value.clone();
        let value_bytes = value_clone.as_bytes();
        let mut index = indexes.iter().rev();
        let mut start = 0;
        let mut prev: usize = 0;

        if let Some(&curr) = index.next() {
            start = curr;
            prev = curr;
        }

        for &curr in index {
            if (curr + 1) != prev {
                match from_utf8(&value_bytes[prev..start + 1]) {
                    Ok(substring) => {
                        value.replace_range(
                            prev..start + 1,
                            format!("{}{}{}", op_tag, substring, ed_tag).as_str(),
                        );
                        start = curr;
                        prev = curr;
                    }
                    Err(_err) => return value,
                }
            } else {
                prev = curr;
            }
        }
        match from_utf8(&value_bytes[prev..start + 1]) {
            Ok(substring) => {
                value.replace_range(
                    prev..start + 1,
                    format!("{}{}{}", op_tag, substring, ed_tag).as_str(),
                );
                value
            }
            Err(_err) => value,
        }
    }
}

fn test(query: String, tag: Option<String>, expected: Vec<HashMap<&str, &str>>) {
    let mut matcher = Matcher::new();
    let items = Vec::from([
        HashMap::from([
            ("name", "very_large_file.dlt"),
            ("size", "20gb"),
            ("path", "/home/user/Desktop/very_large_file.dlt"),
        ]),
        HashMap::from([
            ("name", "medium_sized_file.txt"),
            ("size", "15mb"),
            ("path", "/home/user/Desktop/medium_sized_file.txt"),
        ]),
        HashMap::from([
            ("name", "small_file.log"),
            ("size", "630kb"),
            ("path", "/home/user/Desktop/small_file.log"),
        ]),
    ]);
    for item in &items {
        match serde_json::to_string(&item) {
            Ok(item) => {
                if let Err(err) = matcher.set_item(item) {
                    panic!("{}", err)
                }
            }
            Err(err) => panic!("{}", err),
        }
    }
    matcher.search(query, tag);
    for (index, map) in expected.iter().enumerate() {
        for (&key, &value) in map {
            match matcher.get_html_of(index, key.to_string()) {
                Some(html) => assert_eq!(html, value),
                None => panic!("Failed to get html of {}", key),
            }
        }
    }
}

#[wasm_bindgen_test]
fn all_match() {
    let query = "l".to_string();
    let tag: Option<String> = None;
    let expected = Vec::from([
        HashMap::from([
            ("html_name", "very_<span>l</span>arge_file.dlt"),
            ("html_size", "20gb"),
            (
                "html_path",
                "/home/user/Desktop/very_<span>l</span>arge_file.dlt",
            ),
        ]),
        HashMap::from([
            ("html_name", "medium_sized_fi<span>l</span>e.txt"),
            ("html_size", "15mb"),
            (
                "html_path",
                "/home/user/Desktop/medium_sized_fi<span>l</span>e.txt",
            ),
        ]),
        HashMap::from([
            ("html_name", "small_file.<span>l</span>og"),
            ("html_size", "630kb"),
            (
                "html_path",
                "/home/user/Desktop/small_file.<span>l</span>og",
            ),
        ]),
    ]);
    test(query, tag, expected);
}

#[wasm_bindgen_test]
fn no_match() {
    let query = "c".to_string();
    let tag: Option<String> = None;
    let expected = Vec::from([
        HashMap::from([
            ("html_name", "very_large_file.dlt"),
            ("html_size", "20gb"),
            ("html_path", "/home/user/Desktop/very_large_file.dlt"),
        ]),
        HashMap::from([
            ("html_name", "medium_sized_file.txt"),
            ("html_size", "15mb"),
            ("html_path", "/home/user/Desktop/medium_sized_file.txt"),
        ]),
        HashMap::from([
            ("html_name", "small_file.log"),
            ("html_size", "630kb"),
            ("html_path", "/home/user/Desktop/small_file.log"),
        ]),
    ]);
    test(query, tag, expected);
}

#[wasm_bindgen_test]
fn scattered_match() {
    let query = "mel".to_string();
    let tag: Option<String> = None;
    let expected = Vec::from([
        HashMap::from([
            ("html_name", "very_large_file.dlt"),
            ("html_size", "20gb"),
            (
                "html_path",
                "/ho<span>me</span>/user/Desktop/very_<span>l</span>arge_file.dlt",
            ),
        ]),
        HashMap::from([
            (
                "html_name",
                "<span>me</span>dium_sized_fi<span>l</span>e.txt",
            ),
            ("html_size", "15mb"),
            (
                "html_path",
                "/home/user/Desktop/<span>me</span>dium_sized_fi<span>l</span>e.txt",
            ),
        ]),
        HashMap::from([
            (
                "html_name",
                "s<span>m</span>all_fil<span>e</span>.<span>l</span>og",
            ),
            ("html_size", "630kb"),
            (
                "html_path",
                "/home/user/Desktop/s<span>m</span>all_fil<span>e</span>.<span>l</span>og",
            ),
        ]),
    ]);
    test(query, tag, expected);
}

#[wasm_bindgen_test]
fn few_match() {
    let query = "g".to_string();
    let tag: Option<String> = None;
    let expected = Vec::from([
        HashMap::from([
            ("html_name", "very_lar<span>g</span>e_file.dlt"),
            ("html_size", "20<span>g</span>b"),
            (
                "html_path",
                "/home/user/Desktop/very_lar<span>g</span>e_file.dlt",
            ),
        ]),
        HashMap::from([
            ("html_name", "medium_sized_file.txt"),
            ("html_size", "15mb"),
            ("html_path", "/home/user/Desktop/medium_sized_file.txt"),
        ]),
        HashMap::from([
            ("html_name", "small_file.lo<span>g</span>"),
            ("html_size", "630kb"),
            (
                "html_path",
                "/home/user/Desktop/small_file.lo<span>g</span>",
            ),
        ]),
    ]);
    test(query, tag, expected);
}
