//! Line tokenizer for UTF-16 text input.

use crate::{Error, ParseOutput, ParseYield, RemainderError, SingleParser};

use super::StringMessage;

/// Frames and decodes UTF-16 text into lines, mirroring [`super::StringTokenizer`] for input
/// which is not UTF-8.
///
/// Framing happens on the line feed **code unit** and therefore before decoding: `0x0A` alone
/// is not a terminator in UTF-16, it is one half of any code unit whose other half is `0x0A`.
/// Doing it this way keeps the parser stateless, so no decoder state has to survive between
/// calls, and the decode stays a per-line operation like it is for UTF-8.
///
/// Every item covers an even number of bytes, which is what keeps the parser on code unit
/// boundaries across calls: it never resolves a dangling half unit, it asks for its other half.
/// Alignment is lost only where the producer takes the decision away from the parser, by
/// dropping bytes to resync a buffer which cannot grow.
pub struct Utf16Tokenizer {
    endianness: Utf16Endianness,
}

/// Byte order of a UTF-16 input.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Utf16Endianness {
    Little,
    Big,
}

impl Utf16Tokenizer {
    pub fn new(endianness: Utf16Endianness) -> Self {
        Self { endianness }
    }

    /// The line feed as a code unit of this byte order.
    fn line_feed(&self) -> [u8; 2] {
        match self.endianness {
            Utf16Endianness::Little => [0x0A, 0x00],
            Utf16Endianness::Big => [0x00, 0x0A],
        }
    }

    /// The carriage return as a code unit of this byte order.
    fn carriage_return(&self) -> [u8; 2] {
        match self.endianness {
            Utf16Endianness::Little => [0x0D, 0x00],
            Utf16Endianness::Big => [0x00, 0x0D],
        }
    }

    /// Decodes `units`, replacing unpaired surrogates with `U+FFFD`.
    ///
    /// Callers pass whole code units; a trailing odd byte would be dropped here, which is why
    /// neither of them ever hands one over.
    fn decode(&self, units: &[u8]) -> String {
        let (units, _stray_byte) = units.as_chunks::<2>();

        // The byte order is resolved once per line rather than per code unit: a function
        // pointer picked up here would stay an indirect call inside the decoding loop.
        match self.endianness {
            Utf16Endianness::Little => {
                decode_units(units.iter().map(|unit| u16::from_le_bytes(*unit)))
            }
            Utf16Endianness::Big => {
                decode_units(units.iter().map(|unit| u16::from_be_bytes(*unit)))
            }
        }
    }
}

/// Turns code units into text, replacing unpaired surrogates with `U+FFFD`.
fn decode_units(units: impl Iterator<Item = u16>) -> String {
    char::decode_utf16(units)
        .map(|unit| unit.unwrap_or(char::REPLACEMENT_CHARACTER))
        .collect()
}

impl SingleParser for Utf16Tokenizer {
    type Output = StringMessage;

    /// A line is at least its terminator, which is one code unit.
    const MIN_MSG_LEN: usize = 2;

    fn parse_item(
        &mut self,
        input: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<ParseOutput<StringMessage>, Error> {
        if input.is_empty() {
            return Ok(ParseOutput::new(0, None));
        }

        // Searching whole code units makes every offset here a multiple of two, which is what
        // keeps this parser aligned without tracking a position across calls.
        let (units, _stray_byte) = input.as_chunks::<2>();
        let line_feed = self.line_feed();
        let Some(units_before_break) = units.iter().position(|unit| *unit == line_feed) else {
            // Same reasoning as for UTF-8: without a terminator these bytes are the start of a
            // line, not a line.
            return Err(Error::Incomplete);
        };

        let line = &input[..units_before_break * 2];
        let content = self.decode(line.strip_suffix(&self.carriage_return()).unwrap_or(line));
        let string_msg = StringMessage { content };

        // The terminator is consumed with the line, but is not part of it.
        let consumed = units_before_break * 2 + 2;

        Ok(ParseOutput::new(consumed, Some(string_msg.into())))
    }

    fn parse_remaining(
        &mut self,
        input: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<Option<ParseYield<StringMessage>>, RemainderError> {
        // Half a code unit is an incomplete item and not a line. Returning an item consumes the
        // whole buffer with it, so resolving it here would drop the dangling byte and leave every
        // later load half a unit out of step, silently and for good. Keeping the bytes lets the
        // byte find its partner once the source delivers more, which is what a growing file does.
        if !input.len().is_multiple_of(2) {
            return Ok(None);
        }

        // No more bytes are coming, so the unterminated line is the last line. A trailing
        // carriage return is kept for the same reason as in UTF-8: this line was never
        // terminated, so nothing proves the `\r` belongs to a terminator.
        let string_msg = StringMessage {
            content: self.decode(input),
        };

        Ok(Some(string_msg.into()))
    }
}

#[cfg(test)]
pub(super) mod tests {
    use std::assert_matches;

    use super::*;
    use crate::Parser;

    /// Encodes `text` the way a UTF-16 input of that byte order holds it, without a BOM. Shared
    /// with the sniffing tests of the parent module, which need the same inputs.
    pub fn encode(text: &str, endianness: Utf16Endianness) -> Vec<u8> {
        text.encode_utf16()
            .flat_map(|unit| match endianness {
                Utf16Endianness::Little => unit.to_le_bytes(),
                Utf16Endianness::Big => unit.to_be_bytes(),
            })
            .collect()
    }

    fn parse_all(endianness: Utf16Endianness, input: &[u8]) -> Vec<String> {
        let mut parser = Utf16Tokenizer::new(endianness);

        parser
            .parse(input, None)
            .unwrap()
            .filter_map(|out| match out.message {
                Some(ParseYield::Message(StringMessage { content })) => Some(content),
                _ => None,
            })
            .collect()
    }

    #[test]
    fn multiple_lines_little_endian() {
        let input = encode("hello\nworld\n", Utf16Endianness::Little);

        assert_eq!(
            parse_all(Utf16Endianness::Little, &input),
            ["hello", "world"]
        );
    }

    #[test]
    fn multiple_lines_big_endian() {
        let input = encode("hello\nworld\n", Utf16Endianness::Big);

        assert_eq!(parse_all(Utf16Endianness::Big, &input), ["hello", "world"]);
    }

    #[test]
    fn crlf_terminated_lines() {
        let input = encode("a\r\nb\r\n", Utf16Endianness::Little);

        let mut parser = Utf16Tokenizer::new(Utf16Endianness::Little);
        let out = parser.parse_item(&input, None).unwrap();

        // Two units of content plus terminator: `a`, `\r` and `\n`.
        assert_eq!(out.consumed, 6);
        assert_eq!(parse_all(Utf16Endianness::Little, &input), ["a", "b"]);
    }

    #[test]
    fn embedded_carriage_return_is_kept() {
        let input = encode("a\rb\n", Utf16Endianness::Little);

        assert_eq!(parse_all(Utf16Endianness::Little, &input), ["a\rb"]);
    }

    #[test]
    fn non_ascii_and_surrogate_pairs_are_decoded() {
        // `tamaño` is the accented word of the user report, the emoji needs a surrogate pair.
        let input = encode("tamaño 🐿\n", Utf16Endianness::Little);

        assert_eq!(parse_all(Utf16Endianness::Little, &input), ["tamaño 🐿"]);
    }

    #[test]
    fn line_feed_byte_inside_a_code_unit_is_content() {
        // `U+0A0A` holds the byte `0x0A` in its high half, so a byte-level search for a line
        // break would split this line in the middle of a character.
        let input = encode("a\u{0A0A}b\n", Utf16Endianness::Little);

        assert_eq!(parse_all(Utf16Endianness::Little, &input), ["a\u{0A0A}b"]);
    }

    #[test]
    fn unpaired_surrogate_becomes_replacement_char() {
        // A high surrogate with nothing following it can't be a character.
        let mut input = vec![0x00, 0xD8];
        input.extend_from_slice(&encode("a\n", Utf16Endianness::Little));

        assert_eq!(
            parse_all(Utf16Endianness::Little, &input),
            ["\u{FFFD}a".to_string()]
        );
    }

    #[test]
    fn line_without_terminator_is_incomplete() {
        let mut parser = Utf16Tokenizer::new(Utf16Endianness::Little);
        let input = encode("hello", Utf16Endianness::Little);

        let err = parser.parse_item(&input, None).unwrap_err();

        assert_matches!(err, Error::Incomplete);
    }

    #[test]
    fn half_a_code_unit_is_incomplete() {
        let mut parser = Utf16Tokenizer::new(Utf16Endianness::Little);

        let err = parser.parse_item(&[0x0A], None).unwrap_err();

        assert_matches!(err, Error::Incomplete);
    }

    #[test]
    fn remainder_becomes_the_last_line() {
        let mut parser = Utf16Tokenizer::new(Utf16Endianness::Little);
        let input = encode("last\r", Utf16Endianness::Little);

        let item = Parser::parse_remaining(&mut parser, &input, None).unwrap();

        match item {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("last\r") => {}
            invalid => panic!("Remainder did not match: {invalid:?}"),
        }
    }

    #[test]
    fn remainder_keeps_half_a_code_unit() {
        let mut parser = Utf16Tokenizer::new(Utf16Endianness::Little);
        let mut input = encode("ab", Utf16Endianness::Little);
        input.push(0x63);

        // Resolving this would consume the dangling byte and misalign everything the source
        // delivers afterwards, so the bytes stay with the producer instead.
        let item = Parser::parse_remaining(&mut parser, &input, None).unwrap();

        assert!(item.is_none());
    }
}
