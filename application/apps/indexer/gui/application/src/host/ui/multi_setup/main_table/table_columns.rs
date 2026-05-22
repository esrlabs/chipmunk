use enum_iterator::Sequence;

/// Table columns types for multiple files setup view.
#[derive(Debug, Clone, Copy, PartialEq, Sequence)]
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
}
