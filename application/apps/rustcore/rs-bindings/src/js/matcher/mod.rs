use crate::js::session::events::ComputationErrorWrapper;
pub use matcher::matcher::{Matcher, Sorted};
use node_bindgen::derive::node_bindgen;

struct RustMatcher {
    matcher: Matcher,
}

#[node_bindgen]
impl RustMatcher {
    #[node_bindgen(constructor)]
    pub fn new() -> Self {
        RustMatcher {
            matcher: Matcher::new(),
        }
    }

    #[node_bindgen]
    fn set_items(&mut self, items: Vec<Vec<Vec<String>>>) {
        self.matcher.items = items;
    }

    #[node_bindgen]
    fn search(
        &mut self,
        query: &str,
        keep_zero_score: bool,
        tag: Option<&str>,
    ) -> Result<Sorted, ComputationErrorWrapper> {
        match self.matcher.search(query, keep_zero_score, tag) {
            Ok(matched) => Ok(matched),
            Err(err) => Err(ComputationErrorWrapper(err)),
        }
    }
}
