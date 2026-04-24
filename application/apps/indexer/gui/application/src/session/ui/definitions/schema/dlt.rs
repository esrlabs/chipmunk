use std::ops::Range;

use egui_table::Column;
use parsers::dlt::fmt::DLT_COLUMN_SENTINAL;

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

    fn map_columns(&self, log: &str) -> Vec<Range<usize>> {
        let mut ranges = Vec::with_capacity(self.columns.len());
        map_columns_with_separator(log, &mut ranges, DLT_COLUMN_SENTINAL);

        ranges
    }
}
