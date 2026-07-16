//! Column definitions and sort comparisons for the multi-file table.

use std::cmp::Ordering;

use enum_iterator::Sequence;
use stypes::FileFormat;

use crate::host::ui::multi_setup::state::FileUiState;

/// Table columns types for multiple files setup view.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Sequence)]
pub enum TableColumn {
    Color,
    Type,
    Name,
    Path,
    Size,
    ModifyDate,
}

impl TableColumn {
    pub const fn header(self) -> &'static str {
        match self {
            TableColumn::Color => "",
            TableColumn::Type => "TYPE",
            TableColumn::Name => "NAME",
            TableColumn::Path => "PATH",
            TableColumn::Size => "SIZE",
            TableColumn::ModifyDate => "MOD. DATE",
        }
    }

    /// Compares two files using this column's ordering semantics.
    pub fn compare(self, left: &FileUiState, right: &FileUiState) -> Ordering {
        match self {
            TableColumn::Color => Ordering::Equal,
            TableColumn::Type => {
                let rank = |format| match format {
                    FileFormat::Binary => 0,
                    FileFormat::PcapLegacy => 1,
                    FileFormat::PcapNG => 2,
                    FileFormat::Text => 3,
                };
                rank(left.format).cmp(&rank(right.format))
            }
            TableColumn::Name => left.name.cmp(&right.name),
            TableColumn::Path => left.path.parent().cmp(&right.path.parent()),
            TableColumn::Size => left.size_bytes.cmp(&right.size_bytes),
            TableColumn::ModifyDate => left.modified_at.cmp(&right.modified_at),
        }
    }
}
