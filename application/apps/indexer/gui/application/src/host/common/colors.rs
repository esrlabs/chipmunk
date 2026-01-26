use egui::Color32;

const HIGHLIGHT_COLORS: [ColorPair; 10] = [
    // Red
    ColorPair::new(
        Color32::from_rgb(255, 255, 255),
        Color32::from_rgb(180, 40, 40),
    ),
    // Green
    ColorPair::new(
        Color32::from_rgb(255, 255, 255),
        Color32::from_rgb(40, 160, 40),
    ),
    // Blue
    ColorPair::new(
        Color32::from_rgb(255, 255, 255),
        Color32::from_rgb(40, 80, 180),
    ),
    // Orange
    ColorPair::new(Color32::from_rgb(0, 0, 0), Color32::from_rgb(220, 120, 20)),
    // Purple
    ColorPair::new(
        Color32::from_rgb(255, 255, 255),
        Color32::from_rgb(140, 40, 180),
    ),
    // Teal
    ColorPair::new(Color32::from_rgb(0, 0, 0), Color32::from_rgb(20, 160, 160)),
    // Pink
    ColorPair::new(
        Color32::from_rgb(255, 255, 255),
        Color32::from_rgb(220, 60, 140),
    ),
    // Lime
    ColorPair::new(Color32::from_rgb(0, 0, 0), Color32::from_rgb(160, 200, 20)),
    // Brown
    ColorPair::new(
        Color32::from_rgb(255, 255, 255),
        Color32::from_rgb(120, 80, 40),
    ),
    // Slate
    ColorPair::new(
        Color32::from_rgb(255, 255, 255),
        Color32::from_rgb(80, 100, 120),
    ),
];

#[allow(unused)]
/// Represents a foreground and background color combination.
#[derive(Debug, Clone)]
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

/// Returns a list of available highlighting [`ColorPair`]s.
pub fn highlighting_colors() -> Vec<ColorPair> {
    HIGHLIGHT_COLORS.to_vec()
}
