use std::fmt::Display;

use enum_iterator::Sequence;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Sequence)]
pub enum BottomTabType {
    Search,
    Details,
    Library,
    Presets,
    Chart,
}

impl BottomTabType {
    pub const fn label(self) -> &'static str {
        match self {
            BottomTabType::Search => "Search",
            BottomTabType::Details => "Details",
            BottomTabType::Library => "Library",
            BottomTabType::Presets => "Presets",
            BottomTabType::Chart => "Chart",
        }
    }
}

impl Display for BottomTabType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.label())
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
