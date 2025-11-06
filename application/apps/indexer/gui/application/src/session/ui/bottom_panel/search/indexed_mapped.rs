use std::collections::HashMap;

use stypes::GrabbedElement;

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub struct SearchTableIndex(pub u64);

/// Simple implementation for displaying a window of the logs to be used
/// inside the search logs viewer.
/// This implementation keeps the log element info inside a map with their
/// matching index according to search table view as the keys.
/// Once new elements arrive it will replace all exiting logs with
/// the new ones blindly.
#[derive(Debug, Default)]
pub struct IndexedMapped {
    logs: HashMap<SearchTableIndex, GrabbedElement>,
}

impl IndexedMapped {
    /// Append expect to
    pub fn append(
        &mut self,
        indexed_items: impl Iterator<Item = (SearchTableIndex, GrabbedElement)>,
    ) {
        self.logs.clear();

        indexed_items.for_each(|(idx, item)| {
            self.logs.insert(idx, item);
        });
    }

    pub fn get_element(&self, row_idx: &SearchTableIndex) -> Option<&GrabbedElement> {
        self.logs.get(row_idx)
    }

    pub fn clear(&mut self) {
        self.logs.clear();
    }
}
