use std::ops::Range;

use egui_table::Column;
use stypes::GrabbedElement;

use super::{ColumnInfo, LogSchema};

#[derive(Debug)]
pub struct TextLogSchema {
    columns: [ColumnInfo; 1],
}

impl Default for TextLogSchema {
    fn default() -> Self {
        Self {
            columns: [ColumnInfo::new("", "", Column::default())],
        }
    }
}

impl LogSchema for TextLogSchema {
    fn has_headers(&self) -> bool {
        false
    }

    fn columns(&self) -> &[ColumnInfo] {
        &self.columns
    }

    fn prepare_log(&self, element: &mut GrabbedElement) -> Vec<Range<usize>> {
        let full_rng = 0..element.content.len();

        vec![full_rng]
    }
}
