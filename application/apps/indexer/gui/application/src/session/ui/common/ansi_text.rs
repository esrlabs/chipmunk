//! ANSI SGR parsing for log-cell rendering.
//!
//! This module strips ANSI escape/control sequences from log text and records
//! the visible byte ranges where foreground or background colors should apply.
//! It intentionally implements only color-oriented SGR codes, not full terminal
//! emulation such as cursor movement, screen clearing, or alternate buffers.
//! In common notation `ESC[` starts a CSI sequence, and `m` ends an SGR
//! sequence such as `ESC[31m` for red foreground.

use std::ops::Range;

use anstyle_parse::{DefaultCharAccumulator, Params, Parser, Perform};
use egui::Color32;

/// Text with ANSI escapes removed and color spans resolved over the visible text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AnsiText {
    /// Visible text after ANSI escape/control sequences are removed.
    pub text: String,
    /// Styled byte ranges into `text`.
    pub spans: Vec<AnsiSpan>,
}

/// One colored range in [`AnsiText::text`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AnsiSpan {
    /// Byte range in the stripped visible text.
    pub range: Range<usize>,
    /// Colors active for the range.
    pub style: AnsiStyle,
}

/// ANSI foreground/background colors active for a span.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AnsiStyle {
    /// ANSI foreground color, if one is active.
    pub fg: Option<Color32>,
    /// ANSI background color, if one is active.
    pub bg: Option<Color32>,
}

impl AnsiStyle {
    /// Returns whether this style would affect rendering.
    fn has_style(&self) -> bool {
        self.fg.is_some() || self.bg.is_some()
    }
}

/// Parses `content` into visible text and ANSI color spans.
///
/// Unsupported SGR codes are ignored and malformed escape sequences are stripped
/// without producing a style. Returned ranges always refer to the stripped text.
pub fn parse_ansi_text(content: &str) -> AnsiText {
    // The parser is stateful, so keep it scoped to one cell to avoid leaking an
    // unfinished escape sequence into the next log cell.
    let mut parser = Parser::<DefaultCharAccumulator>::new();
    let mut performer = AnsiPerformer::new(content.len());

    // ANSI parsing is byte-oriented; UTF-8 text is reconstructed by anstyle-parse.
    for byte in content.bytes() {
        parser.advance(&mut performer, byte);
    }

    performer.finish()
}

/// Receives parser events and translates SGR state into visible text spans.
struct AnsiPerformer {
    /// Output accumulated from parser print/execute events.
    text: String,
    /// Completed styled ranges in `text`.
    spans: Vec<AnsiSpan>,
    /// Current SGR color state.
    style: AnsiStyle,
    /// Start of the currently open styled range in `text`, if any.
    span_start: Option<usize>,
}

impl AnsiPerformer {
    /// Creates a performer with enough initial text capacity for common stripped output.
    fn new(capacity: usize) -> Self {
        Self {
            text: String::with_capacity(capacity),
            spans: Vec::new(),
            style: AnsiStyle::default(),
            span_start: None,
        }
    }

    /// Closes any active span and returns the parser output.
    fn finish(mut self) -> AnsiText {
        self.close_span();

        AnsiText {
            text: self.text,
            spans: self.spans,
        }
    }

    /// Appends one visible character and opens a span if a style is active.
    fn push_char(&mut self, c: char) {
        // Style spans are tracked in visible-text byte offsets, not raw input bytes.
        if self.style.has_style() && self.span_start.is_none() {
            self.span_start = Some(self.text.len());
        }

        self.text.push(c);
    }

    /// Changes the active style, closing the previous visible range first.
    fn set_style(&mut self, style: AnsiStyle) {
        if self.style == style {
            return;
        }

        self.close_span();
        self.style = style;
        if self.style.has_style() {
            self.span_start = Some(self.text.len());
        }
    }

    /// Finalizes the current styled range, if it contains visible text.
    fn close_span(&mut self) {
        let Some(start) = self.span_start.take() else {
            return;
        };
        let end = self.text.len();
        if start == end {
            return;
        }

        let span = AnsiSpan {
            range: start..end,
            style: self.style.clone(),
        };

        // Consecutive SGR sequences can reopen the same style; keep output spans compact.
        if let Some(last) = self.spans.last_mut()
            && last.range.end == span.range.start
            && last.style == span.style
        {
            last.range.end = span.range.end;
            return;
        }

        self.spans.push(span);
    }

    /// Applies one SGR parameter list to the current color state.
    fn apply_sgr(&mut self, params: &Params) {
        if params.into_iter().any(|param| param.len() != 1) {
            // Colon-separated SGR forms are intentionally unsupported for now.
            return;
        }

        // Empty SGR (`ESC[m`) is equivalent to reset (`ESC[0m`).
        if params.is_empty() {
            self.set_style(AnsiStyle::default());
            return;
        }

        let mut next_style = self.style.clone();
        let mut codes = params.into_iter().map(|param| param[0]);
        while let Some(code) = codes.next() {
            match code {
                0 => next_style = AnsiStyle::default(),
                // 30..37/40..47 are the standard 8 foreground/background colors.
                30..=37 => next_style.fg = standard_color((code - 30) as u8),
                40..=47 => next_style.bg = standard_color((code - 40) as u8),
                // 90..97/100..107 are the bright foreground/background variants.
                90..=97 => next_style.fg = standard_color((code - 90 + 8) as u8),
                100..=107 => next_style.bg = standard_color((code - 100 + 8) as u8),
                39 => next_style.fg = None,
                49 => next_style.bg = None,
                38 | 48 => {
                    let Some(color) = extended_color(&mut codes) else {
                        break;
                    };
                    if code == 38 {
                        next_style.fg = Some(color);
                    } else {
                        next_style.bg = Some(color);
                    }
                }
                _ => {}
            }
        }

        self.set_style(next_style);
    }
}

impl Perform for AnsiPerformer {
    fn print(&mut self, c: char) {
        self.push_char(c);
    }

    fn execute(&mut self, byte: u8) {
        // Preserve simple whitespace controls that can appear in log text.
        match byte {
            b'\t' => self.push_char('\t'),
            b'\n' => self.push_char('\n'),
            b'\r' => self.push_char('\r'),
            _ => {}
        }
    }

    fn csi_dispatch(&mut self, params: &Params, intermediates: &[u8], ignore: bool, action: u8) {
        // CSI ... m is SGR: Select Graphic Rendition. Other CSI actions are
        // terminal controls, so logs strip them without styling.
        if ignore || action != b'm' || !intermediates.is_empty() {
            return;
        }

        self.apply_sgr(params);
    }
}

/// Parses the payload after SGR `38` or `48` into a concrete color.
fn extended_color(codes: &mut impl Iterator<Item = u16>) -> Option<Color32> {
    // Extended color forms are `38;5;n`/`48;5;n` for xterm indexes and
    // `38;2;r;g;b`/`48;2;r;g;b` for truecolor RGB.
    match codes.next()? {
        5 => {
            let color = u8::try_from(codes.next()?).ok()?;
            Some(indexed_color(color))
        }
        2 => {
            let r = u8::try_from(codes.next()?).ok()?;
            let g = u8::try_from(codes.next()?).ok()?;
            let b = u8::try_from(codes.next()?).ok()?;
            Some(Color32::from_rgb(r, g, b))
        }
        _ => None,
    }
}

/// Resolves an ANSI 16-color palette index.
fn standard_color(index: u8) -> Option<Color32> {
    // Standard terminal 16-color palette: first 8 normal, next 8 bright.
    const COLORS: [(u8, u8, u8); 16] = [
        (0x00, 0x00, 0x00),
        (0x80, 0x00, 0x00),
        (0x00, 0x80, 0x00),
        (0x80, 0x80, 0x00),
        (0x00, 0x00, 0x80),
        (0x80, 0x00, 0x80),
        (0x00, 0x80, 0x80),
        (0xc0, 0xc0, 0xc0),
        (0x80, 0x80, 0x80),
        (0xff, 0x00, 0x00),
        (0x00, 0xff, 0x00),
        (0xff, 0xff, 0x00),
        (0x00, 0x00, 0xff),
        (0xff, 0x00, 0xff),
        (0x00, 0xff, 0xff),
        (0xff, 0xff, 0xff),
    ];

    COLORS
        .get(index as usize)
        .map(|&(r, g, b)| Color32::from_rgb(r, g, b))
}

/// Resolves an xterm 256-color palette index.
fn indexed_color(index: u8) -> Color32 {
    if let Some(color) = standard_color(index) {
        return color;
    }

    // xterm 256-color indexes 16..231 form a 6x6x6 RGB color cube.
    if index <= 231 {
        const LEVELS: [u8; 6] = [0, 95, 135, 175, 215, 255];
        let cube_index = index - 16;
        let r = LEVELS[(cube_index / 36) as usize];
        let g = LEVELS[((cube_index % 36) / 6) as usize];
        let b = LEVELS[(cube_index % 6) as usize];
        return Color32::from_rgb(r, g, b);
    }

    // The remaining indexes are grayscale values from near-black to near-white.
    let level = 8 + (index - 232) * 10;
    Color32::from_rgb(level, level, level)
}

#[cfg(test)]
mod tests {
    use egui::Color32;

    use super::{AnsiSpan, AnsiStyle, parse_ansi_text};

    fn style(fg: Option<Color32>, bg: Option<Color32>) -> AnsiStyle {
        AnsiStyle { fg, bg }
    }

    #[test]
    fn plain_text_has_no_spans() {
        let parsed = parse_ansi_text("plain text");

        assert_eq!(parsed.text, "plain text");
        assert!(parsed.spans.is_empty());
    }

    #[test]
    fn basic_foreground_is_stripped_and_mapped() {
        let parsed = parse_ansi_text("\x1b[31mred");

        assert_eq!(parsed.text, "red");
        assert_eq!(
            parsed.spans,
            vec![AnsiSpan {
                range: 0..3,
                style: style(Some(Color32::from_rgb(0x80, 0x00, 0x00)), None),
            }]
        );
    }

    #[test]
    fn bright_foreground_is_mapped() {
        let parsed = parse_ansi_text("\x1b[91mred");

        assert_eq!(parsed.text, "red");
        assert_eq!(
            parsed.spans[0].style.fg,
            Some(Color32::from_rgb(0xff, 0x00, 0x00))
        );
    }

    #[test]
    fn background_is_mapped() {
        let parsed = parse_ansi_text("\x1b[44mblue bg");

        assert_eq!(parsed.text, "blue bg");
        assert_eq!(
            parsed.spans[0].style.bg,
            Some(Color32::from_rgb(0x00, 0x00, 0x80))
        );
    }

    #[test]
    fn reset_all_closes_current_span() {
        let parsed = parse_ansi_text("\x1b[31mred\x1b[0m plain");

        assert_eq!(parsed.text, "red plain");
        assert_eq!(parsed.spans[0].range, 0..3);
        assert_eq!(parsed.spans.len(), 1);
    }

    #[test]
    fn foreground_and_background_reset_independently() {
        let parsed = parse_ansi_text("\x1b[31;44mred\x1b[39mblue\x1b[49mplain");

        assert_eq!(parsed.text, "redblueplain");
        assert_eq!(
            parsed.spans,
            vec![
                AnsiSpan {
                    range: 0..3,
                    style: style(
                        Some(Color32::from_rgb(0x80, 0x00, 0x00)),
                        Some(Color32::from_rgb(0x00, 0x00, 0x80))
                    ),
                },
                AnsiSpan {
                    range: 3..7,
                    style: style(None, Some(Color32::from_rgb(0x00, 0x00, 0x80))),
                },
            ]
        );
    }

    #[test]
    fn indexed_foreground_and_background_are_mapped() {
        let parsed = parse_ansi_text("\x1b[38;5;196mfg\x1b[48;5;21mbg");

        assert_eq!(parsed.text, "fgbg");
        assert_eq!(parsed.spans[0].style.fg, Some(Color32::from_rgb(255, 0, 0)));
        assert_eq!(
            parsed.spans[1].style,
            style(
                Some(Color32::from_rgb(255, 0, 0)),
                Some(Color32::from_rgb(0, 0, 255))
            )
        );
    }

    #[test]
    fn truecolor_foreground_and_background_are_mapped() {
        let parsed = parse_ansi_text("\x1b[38;2;1;2;3mfg\x1b[48;2;4;5;6mbg");

        assert_eq!(parsed.text, "fgbg");
        assert_eq!(parsed.spans[0].style.fg, Some(Color32::from_rgb(1, 2, 3)));
        assert_eq!(
            parsed.spans[1].style,
            style(
                Some(Color32::from_rgb(1, 2, 3)),
                Some(Color32::from_rgb(4, 5, 6))
            )
        );
    }

    #[test]
    fn malformed_extended_color_is_stripped_without_style() {
        let parsed = parse_ansi_text("\x1b[38;3;43mtext");

        assert_eq!(parsed.text, "text");
        assert!(parsed.spans.is_empty());
    }

    #[test]
    fn unsupported_sgr_is_ignored() {
        let parsed = parse_ansi_text("\x1b[5mblink");

        assert_eq!(parsed.text, "blink");
        assert!(parsed.spans.is_empty());
    }

    #[test]
    fn adjacent_equal_spans_are_merged() {
        let parsed = parse_ansi_text("\x1b[31mred\x1b[31mblue");

        assert_eq!(parsed.text, "redblue");
        assert_eq!(parsed.spans.len(), 1);
        assert_eq!(parsed.spans[0].range, 0..7);
    }

    #[test]
    fn colon_sgr_form_is_stripped_without_style() {
        let parsed = parse_ansi_text("\x1b[38:2:1:2:3mtext");

        assert_eq!(parsed.text, "text");
        assert!(parsed.spans.is_empty());
    }
}
