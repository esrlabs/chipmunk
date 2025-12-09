use std::ops::Range;

use egui_table::Column;
use parsers::dlt::fmt::DLT_COLUMN_SENTINAL;

use super::{ColumnInfo, LogSchema, map_columns_with_separator};

#[derive(Debug)]
pub struct DltLogSchema {
    columns: [ColumnInfo; 11],
}

impl Default for DltLogSchema {
    fn default() -> Self {
        let columns = [
            ColumnInfo::new("Datetime", "Datetime", Column::default()),
            ColumnInfo::new("ECUID", "ECU", Column::default()),
            ColumnInfo::new("VERS", "Dlt Protocol Version (VERS)", Column::default()),
            ColumnInfo::new("SID", "Session ID (SEID)", Column::default()),
            ColumnInfo::new("MCNT", "Message counter (MCNT)", Column::default()),
            ColumnInfo::new("TMS", "Timestamp (TMSP)", Column::default()),
            ColumnInfo::new("EID", "ECU", Column::default()),
            ColumnInfo::new("APID", "Application ID (APID)", Column::default()),
            ColumnInfo::new("CTID", "Context ID (CTID)", Column::default()),
            ColumnInfo::new("MSTP", "Message Type (MSTP)", Column::default()),
            ColumnInfo::new("PAYLOAD", "Payload", Column::default()),
        ];

        Self { columns }
    }
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
