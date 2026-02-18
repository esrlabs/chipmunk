use std::rc::Rc;

use rustc_hash::{FxHashMap, FxHashSet};

use stypes::GrabbedElement;

use crate::session::ui::definitions::{LogTableItem, schema::LogSchema};
/// Simple implementation for displaying a window of the logs to be used
/// inside the main logs viewer.
/// This implementation keeps the logs inside a map with their positions as
/// the keys.
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
    pub fn new(schema: Rc<dyn LogSchema>) -> Self {
        Self {
            logs: FxHashMap::default(),
            source_change_positions: FxHashSet::default(),
            schema,
        }
    }

    pub fn append(&mut self, items: Vec<GrabbedElement>, has_multi_sources: bool) {
        self.logs.clear();
        self.source_change_positions.clear();

        let mut last_source_id = None;

        items.into_iter().for_each(|element| {
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
            self.logs.insert(item.element.pos as u64, item);
        });
    }

    pub fn get_log_item(&self, row_idx: &u64) -> Option<&LogTableItem> {
        self.logs.get(row_idx)
    }

    /// Provides log positions where source is changed for highlighting
    /// as separator in table.
    pub fn source_change_positions(&self) -> &FxHashSet<usize> {
        &self.source_change_positions
    }
}
