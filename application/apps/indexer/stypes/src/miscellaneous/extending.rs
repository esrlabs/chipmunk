use crate::*;

impl GrabbedElement {
    /// Sets the `nature` field of the `GrabbedElement`.
    ///
    /// # Parameters
    /// - `nature`: A `u8` value representing the new nature of the element.
    pub fn set_nature(&mut self, nature: u8) {
        self.nature = nature;
    }
}

impl FilterMatch {
    /// Creates a new `FilterMatch` instance.
    ///
    /// # Parameters
    /// - `index`: The index of the log entry that matches the filter.
    /// - `filters`: A vector of `u8` values representing the filter IDs that matched.
    ///
    /// # Returns
    /// - A new `FilterMatch` instance with the specified index and filters.
    pub fn new(index: u64, filters: Vec<u8>) -> Self {
        Self { index, filters }
    }
}
