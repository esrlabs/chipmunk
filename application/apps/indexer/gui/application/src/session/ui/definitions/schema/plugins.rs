//! Log schema for parser plugins.

use std::ops::Range;

use egui_table::Column;

use parsers::COLUMN_SEPARATOR;
use stypes::{GrabbedElement, ParserRenderOptions};

use super::{ColumnInfo, LogSchema, map_columns_with_separator};

/// Log schema driven by parser plugin render options.
#[derive(Debug)]
pub struct PluginsLogSchema {
    columns: Vec<ColumnInfo>,
    split_columns: bool,
}

impl PluginsLogSchema {
    /// Creates a plugin schema from parser render options.
    pub fn new(render_options: ParserRenderOptions) -> Self {
        let Some(columns_options) = render_options.columns_options else {
            return Self {
                columns: vec![ColumnInfo::new("", "", Column::default())],
                split_columns: false,
            };
        };
        if columns_options.columns.is_empty() {
            return Self {
                columns: vec![ColumnInfo::new("", "", Column::default())],
                split_columns: false,
            };
        }

        let requested_min_width = columns_options.min_width as f32;
        let requested_max_width = columns_options.max_width as f32;
        let min_width = requested_min_width.min(requested_max_width);
        let max_width = requested_min_width.max(requested_max_width);
        let columns = columns_options
            .columns
            .into_iter()
            .map(|column| {
                let width = match column.width {
                    -1 => Column::default(),
                    0..=i16::MAX => Column::new(column.width as f32).range(min_width..=max_width),
                    _ => Column::default(),
                };

                ColumnInfo::new(column.caption, column.description, width)
            })
            .collect();

        Self {
            columns,
            split_columns: true,
        }
    }
}

impl LogSchema for PluginsLogSchema {
    fn has_headers(&self) -> bool {
        self.split_columns
    }

    fn columns(&self) -> &[ColumnInfo] {
        &self.columns
    }

    fn prepare_log(&self, element: &mut GrabbedElement) -> Vec<Range<usize>> {
        if !self.split_columns {
            let range = 0..element.content.len();

            return vec![range];
        }

        let mut ranges = Vec::with_capacity(self.columns.len());
        map_columns_with_separator(&element.content, &mut ranges, COLUMN_SEPARATOR);
        ranges
    }
}

#[cfg(test)]
mod tests {
    use stypes::{ColumnInfo as PluginColumnInfo, ColumnsRenderOptions};

    use super::*;

    fn render_options(columns_options: Option<ColumnsRenderOptions>) -> ParserRenderOptions {
        ParserRenderOptions { columns_options }
    }

    fn columns_options(columns: Vec<PluginColumnInfo>) -> ColumnsRenderOptions {
        ColumnsRenderOptions {
            columns,
            min_width: 20,
            max_width: 200,
        }
    }

    fn plugin_column(caption: &str, description: &str, width: i16) -> PluginColumnInfo {
        PluginColumnInfo {
            caption: caption.to_owned(),
            description: description.to_owned(),
            width,
        }
    }

    fn element(content: &str) -> GrabbedElement {
        GrabbedElement {
            source_id: 0,
            content: content.to_owned(),
            pos: 0,
            nature: 0,
        }
    }

    fn slices<'a>(content: &'a str, ranges: &[Range<usize>]) -> Vec<&'a str> {
        ranges.iter().map(|range| &content[range.clone()]).collect()
    }

    #[test]
    fn no_columns_render_full_row_without_headers() {
        let schema = PluginsLogSchema::new(render_options(None));
        let mut element = element("first\u{0004}second");

        let ranges = schema.prepare_log(&mut element);

        assert!(!schema.has_headers());
        assert_eq!(schema.columns().len(), 1);
        assert_eq!(schema.columns()[0].header, "");
        assert_eq!(
            slices(&element.content, &ranges),
            vec!["first\u{0004}second"]
        );
    }

    #[test]
    fn dynamic_columns_use_metadata_and_fixed_width_ranges() {
        let schema = PluginsLogSchema::new(render_options(Some(columns_options(vec![
            plugin_column("Time", "Event time", 80),
            plugin_column("Message", "Payload", -1),
        ]))));

        let columns = schema.columns();

        assert!(schema.has_headers());
        assert_eq!(columns.len(), 2);
        assert_eq!(columns[0].header, "Time");
        assert_eq!(columns[0].header_tooltip, "Event time");
        assert_eq!(columns[0].column.current, 80.0);
        assert_eq!(columns[0].column.range.min, 20.0);
        assert_eq!(columns[0].column.range.max, 200.0);
        assert_eq!(columns[1].header, "Message");
        assert_eq!(columns[1].column.current, Column::default().current);
        assert_eq!(columns[1].column.range.min, Column::default().range.min);
        assert_eq!(columns[1].column.range.max, Column::default().range.max);
    }

    #[test]
    fn empty_dynamic_columns_render_full_row_without_headers() {
        let schema = PluginsLogSchema::new(render_options(Some(columns_options(Vec::new()))));
        let mut element = element("full row");

        let ranges = schema.prepare_log(&mut element);

        assert!(!schema.has_headers());
        assert_eq!(schema.columns().len(), 1);
        assert_eq!(slices(&element.content, &ranges), vec!["full row"]);
    }

    #[test]
    fn dynamic_columns_normalize_inverted_width_range() {
        let schema = PluginsLogSchema::new(render_options(Some(ColumnsRenderOptions {
            columns: vec![plugin_column("Time", "Event time", 80)],
            min_width: 200,
            max_width: 20,
        })));

        let column = &schema.columns()[0].column;

        assert_eq!(column.range.min, 20.0);
        assert_eq!(column.range.max, 200.0);
    }

    #[test]
    fn dynamic_columns_split_with_parser_separator() {
        let schema = PluginsLogSchema::new(render_options(Some(columns_options(vec![
            plugin_column("A", "A", 10),
            plugin_column("B", "B", 10),
        ]))));
        let mut element = element(&format!("one{COLUMN_SEPARATOR}two"));

        let ranges = schema.prepare_log(&mut element);

        assert_eq!(slices(&element.content, &ranges), vec!["one", "two"]);
    }

    #[test]
    fn dynamic_columns_allow_extra_emitted_fields() {
        let schema = PluginsLogSchema::new(render_options(Some(columns_options(vec![
            plugin_column("A", "A", 10),
            plugin_column("B", "B", 10),
        ]))));
        let mut element = element(&format!("one{COLUMN_SEPARATOR}two{COLUMN_SEPARATOR}three"));

        let ranges = schema.prepare_log(&mut element);

        assert_eq!(
            slices(&element.content, &ranges),
            vec!["one", "two", "three"]
        );
    }
}
