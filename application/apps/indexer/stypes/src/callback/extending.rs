use crate::*;

impl CallbackEvent {
    /// Creates a `CallbackEvent::SearchUpdated` with no search results.
    ///
    /// # Details
    /// This is a convenience method for generating a `SearchUpdated` event
    /// when no matches are found during a search. It sets `found` to `0`
    /// and initializes an empty statistics map (`stat`).
    pub fn no_search_results() -> Self {
        CallbackEvent::SearchUpdated {
            found: 0,
            stat: HashMap::new(),
        }
    }

    /// Creates a `CallbackEvent::SearchUpdated` with the given search results.
    ///
    /// # Parameters
    /// - `found`: The number of matches found during the search.
    /// - `stat`: A map containing search conditions as keys and the global
    ///   match counts as values.
    pub fn search_results(found: u64, stat: HashMap<String, u64>) -> Self {
        CallbackEvent::SearchUpdated { found, stat }
    }
}
