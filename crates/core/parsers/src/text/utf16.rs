//! Line tokenizer for UTF-16 text input.

use memchr::memchr_iter;

use crate::{Error, ParseOutput, ParseYield, Parser, RemainderError};

use super::StringMessage;

/// Frames and decodes UTF-16 text into lines, mirroring [`super::StringTokenizer`] for input
/// which is not UTF-8.
///
/// Framing happens on the line feed **code unit** and therefore before decoding: a `0x0A` byte
/// is no terminator on its own, it can be either half of some other character.
///
/// Every item covers an even number of bytes, which keeps the parser on code unit boundaries
/// across calls: it never resolves a dangling half unit, it asks for its other half.
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
}

impl Parser for Utf16Tokenizer {
    type Output = StringMessage;

    /// Frames all complete lines of `input` with one search pass over the whole buffer.
    ///
    /// The pass runs on bytes, so its matches are candidates which have to be checked against
    /// the code unit grid. Only `0x0A` is searched for: the zero byte of a line feed sits in
    /// every second position of ASCII text, so searching for it would match per character.
    fn parse(
        &mut self,
        input: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = ParseOutput<StringMessage>>, Error> {
        let endianness = self.endianness;
        let mut line_ends = memchr_iter(0x0A, input)
            .filter_map(move |line_feed| endianness.line_feed_unit(input, line_feed))
            .peekable();

        // Without a terminator these bytes are the start of a line, not a line.
        if line_ends.peek().is_none() {
            return Err(Error::Incomplete);
        }

        // Bytes after the last terminator stay unconsumed, for `parse_remaining()` to resolve.
        let mut start = 0;
        let items = line_ends.map(move |line_end| {
            let line = &input[start..line_end];
            // The terminator is consumed with the line, but is not part of it. It is one code
            // unit, so every offset here stays even.
            let consumed = line_end + 2 - start;
            start = line_end + 2;

            let content = endianness.decode(
                line.strip_suffix(&endianness.carriage_return())
                    .unwrap_or(line),
            );
            let string_msg = StringMessage { content };

            ParseOutput::new(consumed, Some(string_msg.into()))
        });

        Ok(items)
    }

    fn parse_remaining(
        &mut self,
        input: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<Option<ParseYield<StringMessage>>, RemainderError> {
        // Half a code unit is no line, and returning an item consumes the whole buffer with it:
        // resolving it here would drop the dangling byte and leave every later load half a unit
        // out of step. Keeping the bytes lets it find its partner if the source delivers more.
        if !input.len().is_multiple_of(2) {
            return Ok(None);
        }

        // No more bytes are coming, so the unterminated line is the last line. A trailing
        // carriage return is kept: this line was never terminated, so nothing proves the `\r`
        // belongs to a terminator.
        let string_msg = StringMessage {
            content: self.endianness.decode(input),
        };

        Ok(Some(string_msg.into()))
    }
}

impl Utf16Endianness {
    /// Offset of the code unit the line feed byte at `line_feed` belongs to, or `None` when
    /// that byte is a half of some other character instead.
    ///
    /// `input` has to start on a code unit boundary, which is what lets the offset of a byte
    /// tell which half of a unit it is.
    fn line_feed_unit(self, input: &[u8], line_feed: usize) -> Option<usize> {
        match self {
            // `0A 00`: the byte opens the unit, so the zero byte after it decides. A buffer
            // ending on the byte holds half a unit and therefore no terminator.
            Self::Little => (line_feed.is_multiple_of(2)
                && input.get(line_feed + 1) == Some(&0x00))
            .then_some(line_feed),
            // `00 0A`: the byte closes the unit, so the zero byte before it decides and the
            // unit starts one byte earlier.
            Self::Big => (!line_feed.is_multiple_of(2) && input[line_feed - 1] == 0x00)
                .then(|| line_feed - 1),
        }
    }

    /// The carriage return as a code unit of this byte order.
    fn carriage_return(self) -> [u8; 2] {
        match self {
            Self::Little => [0x0D, 0x00],
            Self::Big => [0x00, 0x0D],
        }
    }

    /// Decodes `units`, replacing unpaired surrogates with `U+FFFD`.
    ///
    /// Callers pass whole code units: a trailing odd byte is dropped here.
    fn decode(self, units: &[u8]) -> String {
        let (units, _stray_byte) = units.as_chunks::<2>();

        // Resolving the byte order here rather than per code unit keeps the decoding loop free
        // of an indirect call.
        match self {
            Self::Little => decode_units(units.iter().map(|unit| u16::from_le_bytes(*unit))),
            Self::Big => decode_units(units.iter().map(|unit| u16::from_be_bytes(*unit))),
        }
    }
}

/// Turns code units into text, replacing unpaired surrogates with `U+FFFD`.
fn decode_units(units: impl Iterator<Item = u16>) -> String {
    char::decode_utf16(units)
        .map(|unit| unit.unwrap_or(char::REPLACEMENT_CHARACTER))
        .collect()
}

#[cfg(test)]
pub(super) mod tests {
    use std::assert_matches;

    use super::*;

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

    /// Parses `input` expecting it to hold no complete line, and hands back the reported error.
    fn parse_error(endianness: Utf16Endianness, input: &[u8]) -> Error {
        let mut parser = Utf16Tokenizer::new(endianness);

        // The iterator of the success case has no `Debug`, so the error can't be unwrapped.
        let Err(err) = parser.parse(input, None) else {
            panic!("Input without a terminating code unit must not produce a line");
        };

        err
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
        let out = parser.parse(&input, None).unwrap().next().unwrap();

        // Two units of content plus terminator: `a`, `\r` and `\n`.
        assert_eq!(out.consumed, 6);
        assert_eq!(parse_all(Utf16Endianness::Little, &input), ["a", "b"]);
    }

    #[test]
    fn crlf_terminated_lines_big_endian() {
        let input = encode("a\r\nb\r\n", Utf16Endianness::Big);

        let mut parser = Utf16Tokenizer::new(Utf16Endianness::Big);
        let out = parser.parse(&input, None).unwrap().next().unwrap();

        assert_eq!(out.consumed, 6);
        assert_eq!(parse_all(Utf16Endianness::Big, &input), ["a", "b"]);
    }

    #[test]
    fn embedded_carriage_return_is_kept() {
        let input = encode("a\rb\n", Utf16Endianness::Little);

        assert_eq!(parse_all(Utf16Endianness::Little, &input), ["a\rb"]);
    }

    #[test]
    fn non_ascii_and_surrogate_pairs_are_decoded() {
        // The emoji needs a surrogate pair, the accent a two byte encoding in UTF-8.
        let input = encode("tamaño 🐿\n", Utf16Endianness::Little);

        assert_eq!(parse_all(Utf16Endianness::Little, &input), ["tamaño 🐿"]);
    }

    #[test]
    fn line_feed_byte_inside_a_code_unit_is_content() {
        // Both characters hold the byte `0x0A`, `U+0A0A` in both halves and `U+0D0A` next to a
        // `0x0D`, so a byte-level search which trusted its matches would cut them in half.
        let input = encode("a\u{0A0A}b\u{0D0A}c\n", Utf16Endianness::Little);

        assert_eq!(
            parse_all(Utf16Endianness::Little, &input),
            ["a\u{0A0A}b\u{0D0A}c"]
        );
    }

    #[test]
    fn line_feed_byte_inside_a_code_unit_is_content_big_endian() {
        // The same characters with the halves swapped, which puts their `0x0A` on the side a
        // big endian terminator occupies.
        let input = encode("a\u{0A0A}b\u{0D0A}c\n", Utf16Endianness::Big);

        assert_eq!(
            parse_all(Utf16Endianness::Big, &input),
            ["a\u{0A0A}b\u{0D0A}c"]
        );
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
        let input = encode("hello", Utf16Endianness::Little);

        let err = parse_error(Utf16Endianness::Little, &input);

        assert_matches!(err, Error::Incomplete);
    }

    #[test]
    fn empty_input_is_incomplete() {
        let err = parse_error(Utf16Endianness::Little, &[]);

        assert_matches!(err, Error::Incomplete);
    }

    #[test]
    fn half_a_code_unit_is_incomplete() {
        let err = parse_error(Utf16Endianness::Little, &[0x0A]);

        assert_matches!(err, Error::Incomplete);
    }

    #[test]
    fn half_a_terminator_at_the_end_is_incomplete() {
        // `61 00 0A`: the last byte is the low half of a little endian terminator whose high
        // half hasn't arrived, so nothing here is a line yet.
        let mut input = encode("a", Utf16Endianness::Little);
        input.push(0x0A);

        let err = parse_error(Utf16Endianness::Little, &input);

        assert_matches!(err, Error::Incomplete);
    }

    #[test]
    fn half_a_terminator_at_the_end_is_incomplete_big_endian() {
        // `00 61 0A`: the last byte opens a unit, which is the half a big endian terminator
        // holds its zero byte in.
        let mut input = encode("a", Utf16Endianness::Big);
        input.push(0x0A);

        let err = parse_error(Utf16Endianness::Big, &input);

        assert_matches!(err, Error::Incomplete);
    }

    #[test]
    fn remainder_becomes_the_last_line() {
        let mut parser = Utf16Tokenizer::new(Utf16Endianness::Little);
        let input = encode("last\r", Utf16Endianness::Little);

        let item = parser.parse_remaining(&input, None).unwrap();

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
        let item = parser.parse_remaining(&input, None).unwrap();

        assert!(item.is_none());
    }
}
