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
    items: String,
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
            items: String::new(),
        }
    }

    #[wasm_bindgen]
    pub fn set_items(&mut self, items: String) {
        self.items = items;
    }

    #[wasm_bindgen]
    pub fn search_single(
        &self,
        query: String,
        item: String,
        tag: Option<String>,
    ) -> Result<String, String> {
        if query.is_empty() {
            return Ok(item);
        }
        match self.matcher.fuzzy_indices(&item, &query) {
            Some(score) => match self.tag_match(item, score.1, &tag) {
                Ok(tagged_match) => Ok(tagged_match),
                Err(err) => Err(err),
            },
            None => Ok(item),
        }
    }

    pub fn search_multi(
        &self,
        query: String,
        keep_zero_score: bool,
        tag: Option<String>,
    ) -> Result<String, String> {
        let mut total_score: i64;
        let mut temp_hashmap: HashMap<String, String> = HashMap::new();
        let mut evaluated: Vec<(HashMap<String, String>, i64)> = Vec::new();
        let mut sorted: Vec<HashMap<String, String>> = Vec::new();
        let items_json = match serde_json::from_str(&self.items) {
            Err(err) => return Err(format!("Parsing items into JSON String failed: {}", err)),
            Ok::<Vec<HashMap<String, String>>, _>(items) => items,
        };
        for item in items_json {
            total_score = 0;
            for (key, value) in item {
                match self.matcher.fuzzy_indices(value.as_str(), &query) {
                    Some(score) => match self.tag_match(value.to_owned(), score.1, &tag) {
                        Ok(tagged_match) => {
                            temp_hashmap.insert(key.clone(), value.to_owned());
                            temp_hashmap.insert(format!("html_{}", key), tagged_match);
                            total_score += score.0;
                        }
                        Err(err) => return Err(err),
                    },
                    None => {
                        temp_hashmap.insert(key.clone(), value.clone());
                        temp_hashmap.insert(format!("html_{}", key), value);
                    }
                }
            }
            if keep_zero_score || total_score > 0 {
                evaluated.push((temp_hashmap.to_owned(), total_score));
            }
            temp_hashmap.clear();
        }
        evaluated.sort_by(|a, b| b.1.cmp(&a.1));
        for (_, eval) in evaluated.into_iter().enumerate() {
            sorted.push(eval.0);
        }
        match serde_json::to_string(&sorted) {
            Ok(sorted_json) => Ok(sorted_json),
            Err(err) => Err(format!(
                "Parsing sorted object to JSON String failed: {}",
                err
            )),
        }
    }

    fn tag_match(
        &self,
        mut value: String,
        indexes: Vec<usize>,
        tag: &Option<String>,
    ) -> Result<String, String> {
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
                    Err(err) => return Err(format!("Converting bytes to UTF-8 failed: {}", err)),
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
            }
            Err(err) => return Err(format!("Converting bytes to UTF-8 failed: {}", err)),
        }
        Ok(value)
    }
}

#[wasm_bindgen_test]
fn one_match_single() {
    let matcher = Matcher::new();
    let item = "very_large_file.dlt".to_string();
    let query = "e".to_string();
    let expected = "very_large_fil<span>e</span>.dlt".to_string();
    match matcher.search_single(query, item, None) {
        Ok(result) => {
            assert_eq!(result, expected);
        }
        Err(err) => panic!("{}", err),
    }
}

#[wasm_bindgen_test]
fn multi_match_single() {
    let matcher = Matcher::new();
    let item = "very_large_file.dlt".to_string();
    let query = "efd".to_string();
    let expected = "very_larg<span>e</span>_<span>f</span>ile.<span>d</span>lt".to_string();
    match matcher.search_single(query, item, None) {
        Ok(result) => {
            assert_eq!(result, expected);
        }
        Err(err) => panic!("{}", err),
    }
}

#[wasm_bindgen_test]
fn word_match_single() {
    let matcher = Matcher::new();
    let item = "very_large_file.dlt".to_string();
    let query = "large".to_string();
    let expected = "very_<span>large</span>_file.dlt".to_string();
    match matcher.search_single(query, item, None) {
        Ok(result) => {
            assert_eq!(result, expected);
        }
        Err(err) => panic!("{}", err),
    }
}

#[wasm_bindgen_test]
fn whole_match_single() {
    let matcher = Matcher::new();
    let item = "very_large_file.dlt".to_string();
    let query = "very_large_file.dlt".to_string();
    let tag = "h1".to_string();
    let expected = "<h1>very_large_file.dlt</h1>".to_string();
    match matcher.search_single(query, item, Some(tag)) {
        Ok(result) => {
            assert_eq!(result, expected);
        }
        Err(err) => panic!("{}", err),
    }
}

#[wasm_bindgen_test]
fn no_match_single() {
    let matcher = Matcher::new();
    let item = "very_large_file.dlt".to_string();
    let query = "n".to_string();
    let expected = "very_large_file.dlt".to_string();
    match matcher.search_single(query, item, None) {
        Ok(result) => {
            assert_eq!(result, expected);
        }
        Err(err) => panic!("{}", err),
    }
}

fn compare_multi(result: &str, expected: Vec<HashMap<&str, &str>>) {
    match serde_json::from_str(result) {
        Ok::<Vec<HashMap<&str, &str>>, _>(result) => {
            for (i, e_map) in expected.iter().enumerate() {
                for (&e_key, &e_value) in e_map {
                    match result[i].get(e_key) {
                        Some(&r_value) => {
                            assert_eq!(r_value, e_value);
                        }
                        None => panic!("Key '{}' not found", e_key),
                    }
                }
            }
        }
        Err(err) => panic!("Parsing result into JSON String failed: {}", err),
    };
}

fn test_multi(
    query: String,
    keep_zero_score: bool,
    tag: Option<String>,
    expected: Vec<HashMap<&str, &str>>,
) {
    let mut matcher = Matcher::new();
    let items = r#"
    [
        {
            "name": "very_large_file.dlt",
            "size": "20gb",
            "path": "/home/user/Desktop/very_large_file.dlt"
        },
        {
            "name": "medium_sized_file.txt",
            "size": "15mb",
            "path": "/home/user/Desktop/medium_sized_file.txt"
        },
        {
            "name": "small_file.log",
            "size": "630kb",
            "path": "/home/user/Desktop/small_file.log"
        }
    ]"#
    .to_string();
    matcher.set_items(items);
    match matcher.search_multi(query, keep_zero_score, tag) {
        Ok(result) => {
            compare_multi(&result, expected);
        }
        Err(err) => panic!("{}", err),
    }
}

#[wasm_bindgen_test]
fn all_match_multi() {
    let query = "l".to_string();
    let keep_zero_score = true;
    let tag: Option<String> = None;
    let expected = Vec::from([
        HashMap::from([
            ("name", "very_large_file.dlt"),
            ("size", "20gb"),
            ("path", "/home/user/Desktop/very_large_file.dlt"),
            ("html_name", "very_<span>l</span>arge_file.dlt"),
            ("html_size", "20gb"),
            (
                "html_path",
                "/home/user/Desktop/very_<span>l</span>arge_file.dlt",
            ),
        ]),
        HashMap::from([
            ("name", "small_file.log"),
            ("size", "630kb"),
            ("path", "/home/user/Desktop/small_file.log"),
            ("html_name", "small_file.<span>l</span>og"),
            ("html_size", "630kb"),
            (
                "html_path",
                "/home/user/Desktop/small_file.<span>l</span>og",
            ),
        ]),
        HashMap::from([
            ("name", "medium_sized_file.txt"),
            ("size", "15mb"),
            ("path", "/home/user/Desktop/medium_sized_file.txt"),
            ("html_name", "medium_sized_fi<span>l</span>e.txt"),
            ("html_size", "15mb"),
            (
                "html_path",
                "/home/user/Desktop/medium_sized_fi<span>l</span>e.txt",
            ),
        ]),
    ]);
    test_multi(query, keep_zero_score, tag, expected);
}

#[wasm_bindgen_test]
fn no_match_multi_true() {
    let query = "c".to_string();
    let keep_zero_score = true;
    let tag: Option<String> = None;
    let expected = Vec::from([
        HashMap::from([
            ("name", "very_large_file.dlt"),
            ("size", "20gb"),
            ("path", "/home/user/Desktop/very_large_file.dlt"),
            ("html_name", "very_large_file.dlt"),
            ("html_size", "20gb"),
            ("html_path", "/home/user/Desktop/very_large_file.dlt"),
        ]),
        HashMap::from([
            ("name", "medium_sized_file.txt"),
            ("size", "15mb"),
            ("path", "/home/user/Desktop/medium_sized_file.txt"),
            ("html_name", "medium_sized_file.txt"),
            ("html_size", "15mb"),
            ("html_path", "/home/user/Desktop/medium_sized_file.txt"),
        ]),
        HashMap::from([
            ("name", "small_file.log"),
            ("size", "630kb"),
            ("path", "/home/user/Desktop/small_file.log"),
            ("html_name", "small_file.log"),
            ("html_size", "630kb"),
            ("html_path", "/home/user/Desktop/small_file.log"),
        ]),
    ]);
    test_multi(query, keep_zero_score, tag, expected);
}

#[wasm_bindgen_test]
fn no_match_multi_false() {
    let query = "c".to_string();
    let keep_zero_score = false;
    let tag: Option<String> = None;
    let expected = Vec::new();
    test_multi(query, keep_zero_score, tag, expected);
}

#[wasm_bindgen_test]
fn scattered_match_multi() {
    let query = "mel".to_string();
    let keep_zero_score = true;
    let tag: Option<String> = None;
    let expected = Vec::from([
        HashMap::from([
            ("name", "medium_sized_file.txt"),
            ("size", "15mb"),
            ("path", "/home/user/Desktop/medium_sized_file.txt"),
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
            ("name", "small_file.log"),
            ("size", "630kb"),
            ("path", "/home/user/Desktop/small_file.log"),
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
        HashMap::from([
            ("name", "very_large_file.dlt"),
            ("size", "20gb"),
            ("path", "/home/user/Desktop/very_large_file.dlt"),
            ("html_name", "very_large_file.dlt"),
            ("html_size", "20gb"),
            (
                "html_path",
                "/ho<span>me</span>/user/Desktop/very_<span>l</span>arge_file.dlt",
            ),
        ]),
    ]);
    test_multi(query, keep_zero_score, tag, expected);
}

#[wasm_bindgen_test]
fn few_match_multi_true() {
    let query = "g".to_string();
    let keep_zero_score = true;
    let tag: Option<String> = None;
    let expected = Vec::from([
        HashMap::from([
            ("name", "very_large_file.dlt"),
            ("size", "20gb"),
            ("path", "/home/user/Desktop/very_large_file.dlt"),
            ("html_name", "very_lar<span>g</span>e_file.dlt"),
            ("html_size", "20<span>g</span>b"),
            (
                "html_path",
                "/home/user/Desktop/very_lar<span>g</span>e_file.dlt",
            ),
        ]),
        HashMap::from([
            ("name", "small_file.log"),
            ("size", "630kb"),
            ("path", "/home/user/Desktop/small_file.log"),
            ("html_name", "small_file.lo<span>g</span>"),
            ("html_size", "630kb"),
            (
                "html_path",
                "/home/user/Desktop/small_file.lo<span>g</span>",
            ),
        ]),
        HashMap::from([
            ("name", "medium_sized_file.txt"),
            ("size", "15mb"),
            ("path", "/home/user/Desktop/medium_sized_file.txt"),
            ("html_name", "medium_sized_file.txt"),
            ("html_size", "15mb"),
            ("html_path", "/home/user/Desktop/medium_sized_file.txt"),
        ]),
    ]);
    test_multi(query, keep_zero_score, tag, expected);
}

#[wasm_bindgen_test]
fn few_match_multi_false() {
    let query = "g".to_string();
    let keep_zero_score = false;
    let tag: Option<String> = Some("p".to_string());
    let expected = Vec::from([
        HashMap::from([
            ("name", "very_large_file.dlt"),
            ("size", "20gb"),
            ("path", "/home/user/Desktop/very_large_file.dlt"),
            ("html_name", "very_lar<p>g</p>e_file.dlt"),
            ("html_size", "20<p>g</p>b"),
            ("html_path", "/home/user/Desktop/very_lar<p>g</p>e_file.dlt"),
        ]),
        HashMap::from([
            ("name", "small_file.log"),
            ("size", "630kb"),
            ("path", "/home/user/Desktop/small_file.log"),
            ("html_name", "small_file.lo<p>g</p>"),
            ("html_size", "630kb"),
            ("html_path", "/home/user/Desktop/small_file.lo<p>g</p>"),
        ]),
    ]);
    test_multi(query, keep_zero_score, tag, expected);
}
