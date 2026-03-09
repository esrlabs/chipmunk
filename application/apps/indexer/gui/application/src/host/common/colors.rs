use egui::Color32;

const SEARCH_VALUE_COLOR_OFFSET: usize = 3;

/// Strong highlight colors used for source/concat indicators.
pub const SOURCE_HIGHLIGHT_COLORS: [Color32; 10] = [
    // Red
    Color32::from_rgb(180, 40, 40),
    // Green
    Color32::from_rgb(40, 160, 40),
    // Blue
    Color32::from_rgb(40, 80, 180),
    // Orange
    Color32::from_rgb(220, 120, 20),
    // Purple
    Color32::from_rgb(140, 40, 180),
    // Teal
    Color32::from_rgb(20, 160, 160),
    // Pink
    Color32::from_rgb(220, 60, 140),
    // Lime
    Color32::from_rgb(160, 200, 20),
    // Brown
    Color32::from_rgb(120, 80, 40),
    // Slate
    Color32::from_rgb(80, 100, 120),
];

/// Softer highlight colors for table-based filter matches.
pub const FILTER_HIGHLIGHT_COLORS: [ColorPair; 10] = [
    // Red
    ColorPair::new(
        Color32::from_rgb(43, 17, 17),
        Color32::from_rgb(188, 104, 104),
    ),
    // Green
    ColorPair::new(
        Color32::from_rgb(14, 35, 17),
        Color32::from_rgb(111, 171, 117),
    ),
    // Blue
    ColorPair::new(
        Color32::from_rgb(18, 29, 53),
        Color32::from_rgb(117, 145, 202),
    ),
    // Orange
    ColorPair::new(
        Color32::from_rgb(51, 30, 16),
        Color32::from_rgb(204, 154, 108),
    ),
    // Purple
    ColorPair::new(
        Color32::from_rgb(35, 22, 52),
        Color32::from_rgb(157, 126, 195),
    ),
    // Teal
    ColorPair::new(
        Color32::from_rgb(12, 36, 36),
        Color32::from_rgb(102, 176, 176),
    ),
    // Pink
    ColorPair::new(
        Color32::from_rgb(53, 17, 38),
        Color32::from_rgb(204, 123, 166),
    ),
    // Lime
    ColorPair::new(
        Color32::from_rgb(43, 48, 16),
        Color32::from_rgb(176, 194, 109),
    ),
    // Brown
    ColorPair::new(
        Color32::from_rgb(48, 31, 21),
        Color32::from_rgb(162, 132, 108),
    ),
    // Slate
    ColorPair::new(
        Color32::from_rgb(25, 32, 40),
        Color32::from_rgb(131, 145, 161),
    ),
];

/// Represents a foreground and background color combination.
#[derive(Debug, Clone)]
pub struct ColorPair {
    /// Foreground color.
    #[allow(dead_code)]
    pub fg: Color32,
    /// Background color.
    pub bg: Color32,
}

impl ColorPair {
    /// Creates a new [`ColorPair`] with the provided arguments.
    pub const fn new(fg: Color32, bg: Color32) -> Self {
        Self { fg, bg }
    }
}

/// Foreground/background colors used for temporary search highlighting.
pub const TEMP_SEARCH_COLORS: ColorPair = ColorPair::new(
    Color32::from_rgb(230, 234, 244),
    Color32::from_rgb(68, 76, 94),
);

/// Foreground/background colors used for selected log rows.
pub const SELECTED_LOG_COLORS: ColorPair = ColorPair::new(Color32::WHITE, Color32::DARK_GREEN);

/// Returns a list of available source highlighting colors.
pub fn source_highlighting_colors() -> Vec<Color32> {
    SOURCE_HIGHLIGHT_COLORS.to_vec()
}

/// Returns a stable search-value color from the rotated source palette.
pub fn search_value_color(index: usize) -> Color32 {
    // We are using the offset here to keep using one source colors while avoiding
    // having similar colors (red, light-red) in the charts.
    let idx = (index + SEARCH_VALUE_COLOR_OFFSET) % SOURCE_HIGHLIGHT_COLORS.len();
    SOURCE_HIGHLIGHT_COLORS[idx]
}

#[cfg(test)]
mod tests {
    use super::{SOURCE_HIGHLIGHT_COLORS, search_value_color};

    #[test]
    fn search_value_color_uses_rotated_source_palette() {
        assert_eq!(search_value_color(0), SOURCE_HIGHLIGHT_COLORS[3]);
        assert_eq!(search_value_color(1), SOURCE_HIGHLIGHT_COLORS[4]);
        assert_eq!(search_value_color(7), SOURCE_HIGHLIGHT_COLORS[0]);
    }
}
