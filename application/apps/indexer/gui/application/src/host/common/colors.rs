use egui::Color32;

const MAIN_ACCENT_BACKGROUND_DARK: Color32 = Color32::from_rgb(36, 44, 58);
const MAIN_ACCENT_BACKGROUND_LIGHT: Color32 = Color32::from_rgb(220, 228, 240);
const MAIN_ACCENT_STROKE_DARK: Color32 = Color32::from_rgb(145, 193, 255);
const MAIN_ACCENT_STROKE_LIGHT: Color32 = Color32::from_rgb(52, 95, 168);

/// Offset used when reusing the source palette for charts so neighboring filter
/// and chart defaults do not start with visually similar colors.
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
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ColorPair {
    /// Foreground color.
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
pub const DEFAULT_ATTACHMENT_EXT_COLOR: Color32 = egui::Color32::GRAY;

/// Accent background used for structural UI surfaces such as the main rail.
pub fn main_accent_background(dark_mode: bool) -> Color32 {
    if dark_mode {
        MAIN_ACCENT_BACKGROUND_DARK
    } else {
        MAIN_ACCENT_BACKGROUND_LIGHT
    }
}

/// Accent stroke used for emphasized UI strokes, icons, and similar details.
pub fn main_accent_stroke(dark_mode: bool) -> Color32 {
    if dark_mode {
        MAIN_ACCENT_STROKE_DARK
    } else {
        MAIN_ACCENT_STROKE_LIGHT
    }
}

/// Returns the source palette as an owned list for UI code that needs to iterate
/// or display the available colors.
pub fn source_highlighting_colors() -> Vec<Color32> {
    SOURCE_HIGHLIGHT_COLORS.to_vec()
}

/// Returns the first unused filter color pair from the fixed filter palette.
///
/// # Note:
///
/// This is needed because count-based cycling can reuse an already
/// visible color after filters are moved or removed.
pub fn next_filter_color(used_colors: &[ColorPair]) -> ColorPair {
    FILTER_HIGHLIGHT_COLORS
        .iter()
        .find(|color| !used_colors.contains(color))
        .unwrap_or_else(|| {
            &FILTER_HIGHLIGHT_COLORS[used_colors.len() % FILTER_HIGHLIGHT_COLORS.len()]
        })
        .to_owned()
}

/// Returns a stable chart color from the rotated source palette.
///
/// Charts intentionally reuse the source palette with a fixed offset instead of a
/// separate hard-coded list so filter and chart defaults stay related without
/// starting on the same color.
pub fn search_value_color(index: usize) -> Color32 {
    let idx = (index + SEARCH_VALUE_COLOR_OFFSET) % SOURCE_HIGHLIGHT_COLORS.len();
    SOURCE_HIGHLIGHT_COLORS[idx]
}

/// Returns the first unused chart color from the rotated source palette.
///
/// # Note:
///
/// This is needed because count-based cycling can reuse an already
/// visible color after charts are moved or removed.
pub fn next_search_value_color(used_colors: &[Color32]) -> Color32 {
    (0..SOURCE_HIGHLIGHT_COLORS.len())
        .map(search_value_color)
        .find(|color| !used_colors.contains(color))
        .unwrap_or_else(|| search_value_color(used_colors.len()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_value_color_uses_palette() {
        assert_eq!(search_value_color(0), SOURCE_HIGHLIGHT_COLORS[3]);
        assert_eq!(search_value_color(1), SOURCE_HIGHLIGHT_COLORS[4]);
        assert_eq!(search_value_color(7), SOURCE_HIGHLIGHT_COLORS[0]);
    }

    #[test]
    fn next_filter_color_skips_used() {
        let used = [
            FILTER_HIGHLIGHT_COLORS[0].clone(),
            FILTER_HIGHLIGHT_COLORS[2].clone(),
        ];
        let next = next_filter_color(&used);

        assert_eq!(next, FILTER_HIGHLIGHT_COLORS[1]);
    }

    #[test]
    fn next_chart_color_skips_used() {
        let used = [search_value_color(0), search_value_color(2)];
        let next = next_search_value_color(&used);

        assert_eq!(next, search_value_color(1));
    }

    #[test]
    fn main_accent_colors_have_theme_variants() {
        assert_eq!(main_accent_background(true), MAIN_ACCENT_BACKGROUND_DARK);
        assert_eq!(main_accent_background(false), MAIN_ACCENT_BACKGROUND_LIGHT);
        assert_eq!(main_accent_stroke(true), MAIN_ACCENT_STROKE_DARK);
        assert_eq!(main_accent_stroke(false), MAIN_ACCENT_STROKE_LIGHT);
    }
}
