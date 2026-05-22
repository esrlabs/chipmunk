use std::ops::Range;

use egui_table::Column;
use parsers::dlt::fmt::{DLT_ARGUMENT_SENTINAL, DLT_COLUMN_SENTINAL};
use stypes::GrabbedElement;

use super::{ColumnInfo, LogSchema, map_columns_with_separator};

const MIN_COLUMN_WIDTH: f32 = 30.0;
const MAX_COLUMN_WIDTH: f32 = 600.0;

#[derive(Debug)]
pub struct DltLogSchema {
    columns: [ColumnInfo; 11],
}

impl Default for DltLogSchema {
    fn default() -> Self {
        let columns = [
            ColumnInfo::new("Datetime", "Datetime", dlt_column(150.0)),
            ColumnInfo::new("ECUID", "ECU", dlt_column(30.0)),
            ColumnInfo::new("VERS", "Dlt Protocol Version (VERS)", dlt_column(30.0)),
            ColumnInfo::new("SID", "Session ID (SEID)", dlt_column(30.0)),
            ColumnInfo::new("MCNT", "Message counter (MCNT)", dlt_column(30.0)),
            ColumnInfo::new("TMS", "Timestamp (TMSP)", dlt_column(30.0)),
            ColumnInfo::new("EID", "ECU", dlt_column(30.0)),
            ColumnInfo::new("APID", "Application ID (APID)", dlt_column(30.0)),
            ColumnInfo::new("CTID", "Context ID (CTID)", dlt_column(30.0)),
            ColumnInfo::new("MSTP", "Message Type (MSTP)", dlt_column(30.0)),
            ColumnInfo::new("PAYLOAD", "Payload", Column::default()),
        ];

        Self { columns }
    }
}

fn dlt_column(width: f32) -> Column {
    Column::new(width).range(MIN_COLUMN_WIDTH..=MAX_COLUMN_WIDTH)
}

impl LogSchema for DltLogSchema {
    fn has_headers(&self) -> bool {
        true
    }

    fn columns(&self) -> &[ColumnInfo] {
        &self.columns
    }

    fn prepare_log(&self, element: &mut GrabbedElement) -> Vec<Range<usize>> {
        // Replace DLT special payload arguments with simple white spaces in UI.
        element.content = element.content.replace(DLT_ARGUMENT_SENTINAL, " ");

        let mut ranges = Vec::with_capacity(self.columns.len());
        map_columns_with_separator(&element.content, &mut ranges, DLT_COLUMN_SENTINAL);

        ranges
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn element(content: String) -> GrabbedElement {
        GrabbedElement {
            source_id: 0,
            content,
            pos: 0,
            nature: 0,
        }
    }

    fn slices<'a>(content: &'a str, ranges: &[Range<usize>]) -> Vec<&'a str> {
        ranges.iter().map(|range| &content[range.clone()]).collect()
    }

    #[test]
    fn prepare_log_replaces_argument_markers() {
        let schema = DltLogSchema::default();
        let mut element = element(format!("prefix{DLT_ARGUMENT_SENTINAL}arg"));

        let ranges = schema.prepare_log(&mut element);

        assert_eq!(element.content, "prefix arg");
        assert_eq!(slices(&element.content, &ranges), vec!["prefix arg"]);
    }

    #[test]
    fn prepare_log_keeps_column_markers_for_mapping() {
        let schema = DltLogSchema::default();
        let mut element = element(format!(
            "header{DLT_COLUMN_SENTINAL}payload{DLT_ARGUMENT_SENTINAL}value"
        ));

        let ranges = schema.prepare_log(&mut element);

        assert_eq!(
            element.content,
            format!("header{DLT_COLUMN_SENTINAL}payload value")
        );
        assert_eq!(
            slices(&element.content, &ranges),
            vec!["header", "payload value"]
        );
    }
}
