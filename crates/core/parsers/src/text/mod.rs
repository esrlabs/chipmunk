//! Text parsing: the encoding of an input is recognized here, and one of the tokenizers of the
//! submodules turns its bytes into lines.

use std::{fmt, io::Write};

use serde::Serialize;

use crate::LogMessage;

mod utf16;
mod utf8;

pub use utf8::StringTokenizer;
pub use utf16::{Utf16Endianness, Utf16Tokenizer};

/// One line of text, the item both tokenizers produce.
#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct StringMessage {
    content: String,
}

impl fmt::Display for StringMessage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.content)
    }
}

impl LogMessage for StringMessage {
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
        let len = self.content.len();
        writer.write_all(self.content.as_bytes())?;
        Ok(len)
    }
}

/// Encoding of a text input, as far as its first bytes reveal it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextEncoding {
    /// Everything which isn't recognized as UTF-16, decoded lossily by [`StringTokenizer`].
    Utf8,
    Utf16(Utf16Endianness),
}

/// What the first bytes of a text input say about how to read it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TextFormat {
    pub encoding: TextEncoding,
    /// Length of the byte order mark, which the caller has to skip: it marks the input and is
    /// not part of the first line.
    pub bom_len: usize,
}

/// Bytes of the prefix the BOM-less detection looks at. A larger window doesn't make the
/// decision better, and the prefix can be megabytes on a file source.
const SNIFF_WINDOW: usize = 1024;

/// Smallest number of code units the BOM-less detection accepts: over a handful of units a
/// single zero byte already satisfies the ratio below, so any short input could pass as UTF-16.
const SNIFF_MIN_UNITS: usize = 8;

impl TextFormat {
    /// Recognizes UTF-16 in the first bytes of a text input.
    ///
    /// It'll check for BOM. Then without one, the detection will be best effort based on zero
    /// bytes counts and positions assuming the input contains enough ASCII chars. Otherwise,
    /// it'll fallback to UTF-8 encoding
    pub fn sniff(prefix: &[u8]) -> Self {
        // UTF-16 BOMs are checked before the UTF-8 one: they share no prefix, so the order is
        // for the reader only.
        if let Some(rest) = prefix.strip_prefix(&[0xFF, 0xFE]) {
            // `FF FE 00 00` is the UTF-32LE BOM, whose UTF-16 reading is a NUL character.
            // Nothing here supports UTF-32, and reading it as UTF-16 produces garbage either
            // way, so it is left to the lossy UTF-8 path.
            if !rest.starts_with(&[0x00, 0x00]) {
                return Self::with_bom(TextEncoding::Utf16(Utf16Endianness::Little), 2);
            }
        } else if prefix.starts_with(&[0xFE, 0xFF]) {
            return Self::with_bom(TextEncoding::Utf16(Utf16Endianness::Big), 2);
        } else if prefix.starts_with(&[0xEF, 0xBB, 0xBF]) {
            // Kept out of the first line, where it would show up as `U+FEFF`.
            return Self::with_bom(TextEncoding::Utf8, 3);
        }

        let encoding = match Self::sniff_without_bom(prefix) {
            Some(endianness) => TextEncoding::Utf16(endianness),
            None => TextEncoding::Utf8,
        };

        Self {
            encoding,
            bom_len: 0,
        }
    }

    fn with_bom(encoding: TextEncoding, bom_len: usize) -> Self {
        Self { encoding, bom_len }
    }

    /// Guesses the byte order of an unmarked UTF-16 input from the position of its zero bytes.
    ///
    /// Requires one side of the code unit to hold the zero byte of at least half of the units,
    /// and to hold more of them than the other side. UTF-8 text has no zero bytes at all and
    /// stays undecided, and so does text which is mostly non-ASCII, CJK for instance, since
    /// that has no zero bytes in UTF-16 either.
    ///
    /// The dominant side is compared rather than required to be the only one: characters like
    /// `U+0A00`, and the low surrogate of an emoji such as `U+1F600`, put a zero byte on the
    /// other side, so demanding exclusivity would make one emoji hide the encoding of a whole
    /// file.
    fn sniff_without_bom(prefix: &[u8]) -> Option<Utf16Endianness> {
        let window = &prefix[..prefix.len().min(SNIFF_WINDOW)];
        let (units, _stray_byte) = window.as_chunks::<2>();
        let unit_count = units.len();
        if unit_count < SNIFF_MIN_UNITS {
            return None;
        }

        let mut leading_zeros = 0usize;
        let mut trailing_zeros = 0usize;
        for unit in units {
            match unit {
                [0x00, 0x00] => return None,
                [0x00, _] => leading_zeros += 1,
                [_, 0x00] => trailing_zeros += 1,
                _ => {}
            }
        }

        let half = unit_count.div_ceil(2);
        if trailing_zeros >= half && trailing_zeros > leading_zeros {
            Some(Utf16Endianness::Little)
        } else if leading_zeros >= half && leading_zeros > trailing_zeros {
            Some(Utf16Endianness::Big)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use utf16::tests::encode as encode_utf16;

    #[test]
    fn sniff_utf16_boms() {
        let little = TextFormat::sniff(&[0xFF, 0xFE, b'a', 0x00]);
        assert_eq!(
            little.encoding,
            TextEncoding::Utf16(Utf16Endianness::Little)
        );
        assert_eq!(little.bom_len, 2);

        let big = TextFormat::sniff(&[0xFE, 0xFF, 0x00, b'a']);
        assert_eq!(big.encoding, TextEncoding::Utf16(Utf16Endianness::Big));
        assert_eq!(big.bom_len, 2);
    }

    #[test]
    fn sniff_utf8_bom_is_skipped() {
        let format = TextFormat::sniff("\u{FEFF}hello\n".as_bytes());

        assert_eq!(format.encoding, TextEncoding::Utf8);
        assert_eq!(format.bom_len, 3);
    }

    #[test]
    fn sniff_utf16_without_bom() {
        for endianness in [Utf16Endianness::Little, Utf16Endianness::Big] {
            let input = encode_utf16("first line\nsecond line\n", endianness);

            let format = TextFormat::sniff(&input);

            assert_eq!(format.encoding, TextEncoding::Utf16(endianness));
            assert_eq!(format.bom_len, 0);
        }
    }

    #[test]
    fn sniff_utf16_without_bom_tolerates_zero_bytes_on_the_other_side() {
        // The low surrogate of `U+1F600` is `U+DE00`, whose zero byte sits on the side of the
        // code unit which the byte order of the file doesn't use.
        let input = encode_utf16("a line with an emoji \u{1F600}\n", Utf16Endianness::Little);

        let format = TextFormat::sniff(&input);

        assert_eq!(
            format.encoding,
            TextEncoding::Utf16(Utf16Endianness::Little)
        );
    }

    #[test]
    fn sniff_plain_text_is_utf8() {
        // Includes bytes which are invalid UTF-8: the lossy decode handles them, and nothing
        // about them looks like UTF-16.
        let format = TextFormat::sniff(b"a plain log line with tama\xF1o in it\n");

        assert_eq!(format.encoding, TextEncoding::Utf8);
        assert_eq!(format.bom_len, 0);
    }

    #[test]
    fn sniff_falls_back_to_utf8_on_short_input() {
        let input = encode_utf16("abc\n", Utf16Endianness::Little);

        assert_eq!(TextFormat::sniff(&input).encoding, TextEncoding::Utf8);
    }

    #[test]
    fn sniff_falls_back_to_utf8_without_ascii_content() {
        // Chinese characters have no zero byte in UTF-16, so an unmarked file of them is
        // undecidable this way. Accepted limit of the BOM-less detection.
        let input = encode_utf16("每一行都是中文的日志行\n", Utf16Endianness::Little);

        assert_eq!(TextFormat::sniff(&input).encoding, TextEncoding::Utf8);
    }

    #[test]
    fn sniff_rejects_zero_bytes_on_both_sides() {
        // Binary content with zero bytes in both halves of its code units is not UTF-16 text.
        let input = [0x00u8; 64];

        assert_eq!(TextFormat::sniff(&input).encoding, TextEncoding::Utf8);
    }
}
