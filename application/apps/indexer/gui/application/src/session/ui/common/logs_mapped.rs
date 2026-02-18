use std::rc::Rc;

use rustc_hash::{FxHashMap, FxHashSet};
use stypes::GrabbedElement;

use crate::session::ui::definitions::{LogTableItem, schema::LogSchema};

/// Simple implementation for displaying a window of the logs to be used
/// inside the log viewers (e.g., Main Table, Search Table).
/// This implementation keeps the log element info inside a map with their
/// matching index (row number or log position) as the keys.
/// Once new elements arrive it will replace all exiting logs with
/// the new ones blindly.
#[derive(Debug)]
pub struct LogsMapped {
    logs: FxHashMap<u64, LogTableItem>,
    /// Stores log positions where source is changed for highlighting
    /// as separator in table.
    source_change_positions: FxHashSet<usize>,
    schema: Rc<dyn LogSchema>,
}

impl LogsMapped {
    /// Creates a new `LogsMapped` instance.
    ///
    /// # Arguments
    ///
    /// * `schema` - The schema used for parsing and mapping log columns.
    pub fn new(schema: Rc<dyn LogSchema>) -> Self {
        Self {
            logs: FxHashMap::default(),
            source_change_positions: FxHashSet::default(),
            schema,
        }
    }

    /// Appends new log items to the map, replacing any existing content.
    ///
    /// This method clears the current logs and source change positions before
    /// processing the new items. It calculates where source ID changes occur
    /// to support visual separators in the UI.
    ///
    /// # Arguments
    ///
    /// * `indexed_items` - An iterator of tuples containing the index (row number or position)
    ///   and the `GrabbedElement`.
    /// * `has_multi_sources` - A flag indicating if multiple data sources are present.
    ///   If true, source changes will be tracked.
    pub fn append(
        &mut self,
        indexed_items: impl Iterator<Item = (u64, GrabbedElement)>,
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

    /// Retrieves a reference to a `LogTableItem` by its index.
    ///
    /// # Arguments
    ///
    /// * `row_idx` - The key (row number or log position) to look up.
    pub fn get_log_item(&self, row_idx: &u64) -> Option<&LogTableItem> {
        self.logs.get(row_idx)
    }

    /// Clears all stored logs and source change positions.
    pub fn clear(&mut self) {
        let Self {
            logs,
            source_change_positions,
            schema: _,
        } = self;

        logs.clear();
        source_change_positions.clear();
    }

    /// Returns the set of log positions where the source ID has changed.
    ///
    /// These positions are used by the UI to draw separator lines between
    /// logs from different sources.
    pub fn source_change_positions(&self) -> &FxHashSet<usize> {
        &self.source_change_positions
    }
}
