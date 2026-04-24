use std::ops::Range;

use stypes::GrabbedElement;

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

    fn prepare_log(&self, _element: &mut GrabbedElement) -> Vec<Range<usize>> {
        todo!("Plugins are not implemented yet");
    }
}
