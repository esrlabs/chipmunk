use std::fmt::Display;

use enum_iterator::Sequence;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Sequence)]
pub enum BottomTabType {
    Search,
    Details,
    Library,
    Presets,
    Chart,
}

impl Display for BottomTabType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BottomTabType::Search => f.write_str("Search"),
            BottomTabType::Details => f.write_str("Details"),
            BottomTabType::Library => f.write_str("Library"),
            BottomTabType::Presets => f.write_str("Presets"),
            BottomTabType::Chart => f.write_str("Chart"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use enum_iterator::all;

    #[test]
    fn all_keeps_library_order() {
        assert_eq!(
            all::<BottomTabType>().collect::<Vec<_>>(),
            vec![
                BottomTabType::Search,
                BottomTabType::Details,
                BottomTabType::Library,
                BottomTabType::Presets,
                BottomTabType::Chart,
            ]
        );
    }
}
