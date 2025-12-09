use std::ops::Range;

use egui_table::Column;

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

    // Clippy false positive because it thinks here that we want to
    // initialize Vec<usize> with the given range.
    // TODO: Remove when GitHub issue is resolved.
    // Issue link: https://github.com/rust-lang/rust-clippy/issues/11086.
    #[allow(clippy::single_range_in_vec_init)]
    fn map_columns(&self, log: &str) -> Vec<Range<usize>> {
        vec![0..log.len()]
    }
}
