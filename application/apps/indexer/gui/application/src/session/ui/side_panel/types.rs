use std::fmt::Display;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SideTabType {
    Observing,
    Attachments,
    Filters,
}

impl SideTabType {
    pub fn all() -> &'static [SideTabType] {
        // Reminder to add new items to this function
        match SideTabType::Observing {
            SideTabType::Observing => {}
            SideTabType::Attachments => {}
            SideTabType::Filters => {}
        }

        &[
            SideTabType::Observing,
            SideTabType::Attachments,
            SideTabType::Filters,
        ]
    }
}

impl Display for SideTabType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let content = match self {
            SideTabType::Observing => "Observing",
            SideTabType::Attachments => "Attachments",
            SideTabType::Filters => "Filters",
        };

        f.write_str(content)
    }
}
