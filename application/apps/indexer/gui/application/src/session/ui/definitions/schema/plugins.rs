use std::ops::Range;

use super::LogSchema;

#[derive(Debug)]
pub struct PluginsLogSchema;

impl LogSchema for PluginsLogSchema {
    fn has_headers(&self) -> bool {
        todo!("Plugins are not implemented yet");
    }

    fn columns(&self) -> &[super::ColumnInfo] {
        todo!("Plugins are not implemented yet");
    }

    fn map_columns(&self, _log: &str) -> Vec<Range<usize>> {
        todo!("Plugins are not implemented yet");
    }
}
