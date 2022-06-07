use crate::js::session::events::ComputationErrorWrapper;
pub use matching::matcher::{Matcher, SkimMatcherV2, Sorted};
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
        query: String,
        keep_zero_score: bool,
        tag: Option<String>,
    ) -> Result<Sorted, ComputationErrorWrapper> {
        let origin: String = tag.unwrap_or_else(|| "".to_string());
        match self.matcher.search(
            query.as_ref(),
            keep_zero_score,
            if origin.is_empty() {
                None
            } else {
                Some(origin.as_ref())
            },
        ) {
            Ok(matched) => Ok(matched),
            Err(err) => Err(ComputationErrorWrapper(err)),
        }
    }
}
