use fuzzy_matcher::{skim::SkimMatcherV2, FuzzyMatcher};
use session::events::ComputationError;
use std::str::from_utf8;

pub type Sorted = Vec<Vec<Vec<String>>>;

pub struct Matcher {
    matcher: SkimMatcherV2,
    pub items: Sorted,
}

impl Default for Matcher {
    fn default() -> Self {
        Self::new()
    }
}

impl Matcher {
    pub fn new() -> Self {
        Self {
            matcher: SkimMatcherV2::default(),
            items: Vec::new(),
        }
    }

    pub fn set_items(&mut self, items: Sorted) {
        self.items = items;
    }

    pub fn search(
        &self,
        query: &str,
        keep_zero_score: bool,
        tag: Option<&str>,
    ) -> Result<Sorted, ComputationError> {
        let mut evaluated: Vec<(Vec<Vec<String>>, i64)> = Vec::new();
        let mut sorted: Sorted = Vec::new();
        let mut temp_hashmap: Vec<Vec<String>> = Vec::new();
        let mut total_score;
        for item in &self.items {
            total_score = 0;
            for hashmap in item {
                if let Some((key, value)) = hashmap.get(0).zip(hashmap.get(1)) {
                    match self.matcher.fuzzy_indices(value.as_str(), query) {
                        Some(score) => match self.tag_match(value.to_string(), score.1, tag) {
                            Ok(tagged_match) => {
                                temp_hashmap.push(Vec::from([key.clone(), tagged_match]));
                                total_score += score.0;
                            }
                            Err(err) => return Err(err),
                        },
                        None => {
                            temp_hashmap.push(Vec::from([key.clone(), value.clone()]));
                        }
                    }
                }
            }
            if keep_zero_score || total_score > 0 {
                evaluated.push((temp_hashmap.to_owned(), total_score));
            }
            temp_hashmap.clear();
        }
        evaluated.sort_by(|a, b| b.1.cmp(&a.1));
        for e in evaluated {
            sorted.push(e.0);
        }
        Ok(sorted)
    }

    fn tag_match(
        &self,
        mut value: String,
        indexes: Vec<usize>,
        tag: Option<&str>,
    ) -> Result<String, ComputationError> {
        let tag = tag.unwrap_or("span");
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
                    Err(err) => {
                        return Err(ComputationError::Matcher(format!(
                            "Converting bytes to UTF-8 failed: {}",
                            err
                        )));
                    }
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
            Err(err) => {
                return Err(ComputationError::Matcher(format!(
                    "Converting bytes to UTF-8 failed: {}",
                    err
                )));
            }
        }
        Ok(value)
    }
}

#[cfg(test)]
mod test {
    use crate::matcher::{Matcher, Sorted};

    fn tester(matched: Sorted, result: Sorted) {
        for (m, r) in matched.into_iter().zip(result) {
            for (m_hashmap, r_hashmap) in m.iter().zip(&r) {
                for (m_component, r_component) in m_hashmap.iter().zip(r_hashmap) {
                    assert_eq!(m_component, r_component);
                }
            }
        }
    }

    #[test]
    fn test_empty_query() {
        let mut matcher = Matcher::new();
        let query = "";

        matcher.set_items(Vec::from([
            Vec::from([Vec::from(["name".to_string(), "Chipmunk".to_string()])]),
            Vec::from([Vec::from([
                "caption".to_string(),
                "example.dlt".to_string(),
            ])]),
            Vec::from([Vec::from(["filter".to_string(), "Error".to_string()])]),
        ]));
        assert!(matcher
            .search(query, false, None)
            .expect("Sorting matches failed")
            .is_empty());
    }

    #[test]
    fn test_empty_items() {
        let mut matcher = Matcher::new();
        let query = "ee";

        matcher.set_items(Vec::new());

        assert!(matcher
            .search(query, false, None)
            .expect("Sorting matches failed")
            .is_empty());
    }

    #[test]
    fn test_full_match() {
        let mut matcher = Matcher::new();
        let query = "error";

        matcher.set_items(Vec::from([Vec::from([Vec::from([
            "type".to_string(),
            "Error".to_string(),
        ])])]));

        let result = Vec::from([
            Vec::from([Vec::from(["type".to_string(), "<p>Error</p>".to_string()])]),
            Vec::from([Vec::from(["type".to_string(), "Warning".to_string()])]),
            Vec::from([Vec::from(["type".to_string(), "Info".to_string()])]),
        ]);
        let matched = matcher
            .search(query, true, Some("p"))
            .expect("Sorting matches failed");

        tester(matched, result);
    }

    #[test]
    fn test_scattered_match() {
        let mut matcher = Matcher::new();
        let query = "eee";

        matcher.set_items(Vec::from([
            Vec::from([
                Vec::from(["level".to_string(), "Severe".to_string()]),
                Vec::from(["name".to_string(), "Very bad error occurred".to_string()]),
            ]),
            Vec::from([
                Vec::from(["level".to_string(), "Critical".to_string()]),
                Vec::from(["name".to_string(), "Not so bad".to_string()]),
            ]),
        ]));

        let result = Vec::from([
            (Vec::from([
                Vec::from([
                    "level".to_string(),
                    "S<span>e</span>v<span>e</span>r<span>e</span>".to_string(),
                ]),
                Vec::from([
                    "name".to_string(),
                    "V<span>e</span>ry bad <span>e</span>rror occurr<span>e</span>d".to_string(),
                ]),
            ])),
            Vec::from([
                Vec::from(["level".to_string(), "Critical".to_string()]),
                Vec::from(["name".to_string(), "Not so bad".to_string()]),
            ]),
        ]);
        let matched = matcher
            .search(query, true, None)
            .expect("Sorting matches failed");
        tester(matched, result);
    }
}
