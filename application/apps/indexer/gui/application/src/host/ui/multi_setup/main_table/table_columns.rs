/// Table columns types for multiple files setup view.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TableColumn {
    Color,
    Type,
    Name,
    Path,
    Size,
    ModifyDate,
}

impl TableColumn {
    pub const fn all() -> &'static [Self] {
        // Reminder to extend all on new fields
        match Self::Type {
            TableColumn::Color => {}
            TableColumn::Type => {}
            TableColumn::Name => {}
            TableColumn::Path => {}
            TableColumn::Size => {}
            TableColumn::ModifyDate => {}
        };

        &[
            TableColumn::Color,
            TableColumn::Type,
            TableColumn::Name,
            TableColumn::Path,
            TableColumn::Size,
            TableColumn::ModifyDate,
        ]
    }

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
