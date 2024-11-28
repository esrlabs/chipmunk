use crate::*;

impl CallbackEvent {
    pub fn no_search_results() -> Self {
        CallbackEvent::SearchUpdated {
            found: 0,
            stat: HashMap::new(),
        }
    }

    pub fn search_results(found: u64, stat: HashMap<String, u64>) -> Self {
        CallbackEvent::SearchUpdated { found, stat }
    }
}
