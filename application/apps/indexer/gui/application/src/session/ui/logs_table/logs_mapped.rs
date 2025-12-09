use std::{collections::HashMap, rc::Rc};

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
    logs: HashMap<u64, LogTableItem>,
    schema: Rc<dyn LogSchema>,
}

impl LogsMapped {
    pub fn new(schema: Rc<dyn LogSchema>) -> Self {
        Self {
            logs: HashMap::new(),
            schema,
        }
    }

    pub fn append(&mut self, items: Vec<GrabbedElement>) {
        self.logs.clear();

        items.into_iter().for_each(|element| {
            let column_ranges = self.schema.map_columns(&element.content);
            let item = LogTableItem {
                element,
                column_ranges,
            };
            self.logs.insert(item.element.pos as u64, item);
        });
    }

    pub fn get_log_content(&self, row_idx: &u64, col_idx: usize) -> Option<&str> {
        self.logs.get(row_idx).and_then(|item| {
            item.column_ranges
                .get(col_idx)
                .and_then(|rng| item.element.content.get(rng.clone()))
        })
    }
}
