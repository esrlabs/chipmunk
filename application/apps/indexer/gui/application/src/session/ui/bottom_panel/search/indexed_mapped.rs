use std::{collections::HashMap, rc::Rc};

use stypes::GrabbedElement;

use crate::session::ui::definitions::{LogTableItem, schema::LogSchema};

#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub struct SearchTableIndex(pub u64);

/// Simple implementation for displaying a window of the logs to be used
/// inside the search logs viewer.
/// This implementation keeps the log element info inside a map with their
/// matching index according to search table view as the keys.
/// Once new elements arrive it will replace all exiting logs with
/// the new ones blindly.
#[derive(Debug)]
pub struct IndexedMapped {
    logs: HashMap<SearchTableIndex, LogTableItem>,
    schema: Rc<dyn LogSchema>,
}

impl IndexedMapped {
    pub fn new(schema: Rc<dyn LogSchema>) -> Self {
        Self {
            logs: HashMap::new(),
            schema,
        }
    }

    /// Append expect to
    pub fn append(
        &mut self,
        indexed_items: impl Iterator<Item = (SearchTableIndex, GrabbedElement)>,
    ) {
        self.logs.clear();

        indexed_items.for_each(|(idx, element)| {
            let column_ranges = self.schema.map_columns(&element.content);
            let item = LogTableItem {
                element,
                column_ranges,
            };
            self.logs.insert(idx, item);
        });
    }

    pub fn get_log_item(&self, row_idx: &SearchTableIndex) -> Option<&LogTableItem> {
        self.logs.get(row_idx)
    }

    pub fn clear(&mut self) {
        self.logs.clear();
    }
}
