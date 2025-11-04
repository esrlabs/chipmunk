use std::collections::HashMap;

use stypes::GrabbedElement;

/// Simple implementation for displaying a window of the logs to be used
/// inside the main logs viewer.
/// This implementation keeps the logs inside a map with their positions as
/// the keys.
/// Once new elements arrive it will replace all exiting logs with
/// the new ones blindly.
#[derive(Debug, Default)]
pub struct LogsMapped {
    logs: HashMap<u64, GrabbedElement>,
}

impl LogsMapped {
    pub fn append(&mut self, items: Vec<GrabbedElement>) {
        self.logs.clear();

        items.into_iter().for_each(|item| {
            self.logs.insert(item.pos as u64, item);
        });
    }

    pub fn get_log(&self, row_idx: &u64) -> Option<&str> {
        self.logs.get(row_idx).map(|s| s.content.as_str())
    }
}
