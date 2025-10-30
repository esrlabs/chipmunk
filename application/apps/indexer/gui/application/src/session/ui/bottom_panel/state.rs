use std::fmt::Display;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BottomTabType {
    Search,
    Details,
    Presets,
    Chart,
}

impl BottomTabType {
    pub fn all() -> &'static [BottomTabType] {
        // Reminder to add new items to this function
        match BottomTabType::Search {
            BottomTabType::Search => {}
            BottomTabType::Details => {}
            BottomTabType::Presets => {}
            BottomTabType::Chart => {}
        };

        &[
            BottomTabType::Search,
            BottomTabType::Details,
            BottomTabType::Presets,
            BottomTabType::Chart,
        ]
    }
}

impl Display for BottomTabType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BottomTabType::Search => f.write_str("Search"),
            BottomTabType::Details => f.write_str("Details"),
            BottomTabType::Presets => f.write_str("Presets/Histroy"),
            BottomTabType::Chart => f.write_str("Chart"),
        }
    }
}

#[derive(Debug)]
pub struct BottomUiState {
    pub active_tab: BottomTabType,
}

impl Default for BottomUiState {
    fn default() -> Self {
        Self {
            active_tab: BottomTabType::Search,
        }
    }
}
