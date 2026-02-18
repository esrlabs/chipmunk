use std::rc::Rc;

use rustc_hash::{FxHashMap, FxHashSet};
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
    logs: FxHashMap<SearchTableIndex, LogTableItem>,
    /// Stores log positions where source is changed for highlighting
    /// as separator in table.
    source_change_positions: FxHashSet<usize>,
    schema: Rc<dyn LogSchema>,
}

impl IndexedMapped {
    pub fn new(schema: Rc<dyn LogSchema>) -> Self {
        Self {
            logs: FxHashMap::default(),
            source_change_positions: FxHashSet::default(),
            schema,
        }
    }

    /// Append expect to
    pub fn append(
        &mut self,
        indexed_items: impl Iterator<Item = (SearchTableIndex, GrabbedElement)>,
        has_multi_sources: bool,
    ) {
        self.logs.clear();
        self.source_change_positions.clear();

        let mut last_source_id = None;

        indexed_items.for_each(|(idx, element)| {
            if has_multi_sources {
                match &mut last_source_id {
                    Some(source_id) if *source_id != element.source_id => {
                        self.source_change_positions.insert(element.pos);
                        *source_id = element.source_id;
                    }
                    _ => last_source_id = Some(element.source_id),
                }
            }

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
        let Self {
            logs,
            source_change_positions,
            schema: _,
        } = self;

        logs.clear();
        source_change_positions.clear();
    }

    /// Provides log positions where source is changed for highlighting
    /// as separator in table.
    pub fn source_change_positions(&self) -> &FxHashSet<usize> {
        &self.source_change_positions
    }
}
