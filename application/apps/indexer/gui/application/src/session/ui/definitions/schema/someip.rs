use std::ops::Range;

use egui_table::Column;

use super::{ColumnInfo, LogSchema, map_columns_with_separator};

#[derive(Debug)]
pub struct SomeIpLogSchema {
    columns: [ColumnInfo; 10],
}

impl Default for SomeIpLogSchema {
    fn default() -> Self {
        let columns = [
            ColumnInfo::new("SOME/IP", "The Message-Kind.", Column::default()),
            ColumnInfo::new("SERV", "The Service-ID", Column::default()),
            ColumnInfo::new("METH", "The Method-ID", Column::default()),
            ColumnInfo::new("LENG", "The Length-Field", Column::default()),
            ColumnInfo::new("CLID", "The Client-ID", Column::default()),
            ColumnInfo::new("SEID", "The Session-ID", Column::default()),
            ColumnInfo::new("IVER", "The Interface-Version", Column::default()),
            ColumnInfo::new("MSTP", "The Message-Type", Column::default()),
            ColumnInfo::new("RETC", "The Return-Code", Column::default()),
            ColumnInfo::new("PAYLOAD", "Payload", Column::default()),
        ];

        Self { columns }
    }
}

impl LogSchema for SomeIpLogSchema {
    fn has_headers(&self) -> bool {
        true
    }

    fn columns(&self) -> &[ColumnInfo] {
        &self.columns
    }

    fn map_columns(&self, log: &str) -> Vec<Range<usize>> {
        use parsers::someip::COLUMN_SEP as SOMEIP_COLUMN_SEP;

        let mut ranges = Vec::with_capacity(self.columns.len());
        map_columns_with_separator(log, &mut ranges, SOMEIP_COLUMN_SEP);
        ranges
    }
}
