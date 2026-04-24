use std::ops::Range;

use egui_table::Column;

use super::{ColumnInfo, LogSchema, map_columns_with_separator};

const MIN_COLUMN_WIDTH: f32 = 30.0;
const MAX_COLUMN_WIDTH: f32 = 600.0;

#[derive(Debug)]
pub struct SomeIpLogSchema {
    columns: [ColumnInfo; 10],
}

impl Default for SomeIpLogSchema {
    fn default() -> Self {
        let columns = [
            ColumnInfo::new("SOME/IP", "The Message-Kind.", someip_column(50.0)),
            ColumnInfo::new("SERV", "The Service-ID", someip_column(50.0)),
            ColumnInfo::new("METH", "The Method-ID", someip_column(50.0)),
            ColumnInfo::new("LENG", "The Length-Field", someip_column(30.0)),
            ColumnInfo::new("CLID", "The Client-ID", someip_column(30.0)),
            ColumnInfo::new("SEID", "The Session-ID", someip_column(30.0)),
            ColumnInfo::new("IVER", "The Interface-Version", someip_column(30.0)),
            ColumnInfo::new("MSTP", "The Message-Type", someip_column(30.0)),
            ColumnInfo::new("RETC", "The Return-Code", someip_column(30.0)),
            ColumnInfo::new("PAYLOAD", "Payload", Column::default()),
        ];

        Self { columns }
    }
}

fn someip_column(width: f32) -> Column {
    Column::new(width).range(MIN_COLUMN_WIDTH..=MAX_COLUMN_WIDTH)
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
