use std::fmt::Display;

use enum_iterator::Sequence;

#[derive(Debug, Clone, Copy, PartialEq, Sequence)]
pub enum SideTabType {
    Observing,
    Attachments,
    Filters,
    Chat,
}

impl Display for SideTabType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let content = match self {
            SideTabType::Observing => "Observing",
            SideTabType::Attachments => "Attachments",
            SideTabType::Filters => "Filters",
            SideTabType::Chat => "Chat",
        };

        f.write_str(content)
    }
}
