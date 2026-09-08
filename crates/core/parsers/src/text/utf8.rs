//! Line tokenizer for UTF-8 text input, and for everything which isn't recognized as another
//! encoding.

use memchr::memchr_iter;

use crate::{Error, ParseOutput, ParseYield, Parser, RemainderError};

use super::StringMessage;

pub struct StringTokenizer {}

impl Parser for StringTokenizer {
    type Output = StringMessage;

    /// Frames all complete lines of `input` with one search pass over the whole buffer.
    ///
    /// This is where bytes of text input become text, so line content rules like CRLF live here.
    fn parse(
        &mut self,
        input: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = ParseOutput<StringMessage>>, Error> {
        let mut line_ends = memchr_iter(b'\n', input).peekable();

        // Without a line break the input is the start of a line and not a line: reporting it as
        // one would split every line that straddles a source buffer boundary.
        if line_ends.peek().is_none() {
            return Err(Error::Incomplete);
        }

        // Bytes after the last line break stay unconsumed, for `parse_remaining()` to resolve.
        let mut start = 0;
        let items = line_ends.map(move |line_end| {
            let line = &input[start..line_end];
            // The terminator is consumed with the line, but is not part of it.
            let consumed = line_end + 1 - start;
            start = line_end + 1;

            // The `\r` of a `\r\n` terminator belongs to the terminator, not to the line. An
            // `\r` anywhere else is content and stays.
            let content = String::from_utf8_lossy(line.strip_suffix(b"\r").unwrap_or(line));
            let string_msg = StringMessage {
                content: content.into_owned(),
            };

            ParseOutput::new(consumed, Some(string_msg.into()))
        });

        Ok(items)
    }

    fn parse_remaining(
        &mut self,
        input: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<Option<ParseYield<StringMessage>>, RemainderError> {
        // No more bytes are coming, so the unterminated line is the last line. A trailing `\r`
        // is kept: this line was never terminated, so nothing proves the `\r` is part of a
        // terminator rather than content.
        let content = String::from_utf8_lossy(input);
        let string_msg = StringMessage {
            content: content.into_owned(),
        };
        let last_line = string_msg.into();

        Ok(Some(last_line))
    }
}

#[cfg(test)]
mod tests {
    use std::assert_matches;

    use crate::Parser;

    use super::*;

    #[test]
    fn unterminated_last_line_is_left_to_the_remainder() {
        let mut parser = StringTokenizer {};
        let content = b"hello\nworld";

        let mut items_iter = parser.parse(content, None).unwrap();

        let out = items_iter.next().unwrap();
        assert_eq!(out.consumed, 6);
        match out.message {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("hello") => {}
            invalid => panic!("Message did not match: {invalid:?}"),
        }
        assert!(items_iter.next().is_none());
    }

    #[test]
    fn one_parse_call() {
        let mut parser = StringTokenizer {};
        let content = b"hello\nworld\n";
        let mut items_iter = parser.parse(content, None).unwrap();

        let out1 = items_iter.next().unwrap();
        match out1.message {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("hello") => {}
            _ => panic!("First message did not match"),
        }
        let out2 = items_iter.next().unwrap();
        match out2.message {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("world") => {}
            _ => panic!("Second message did not match"),
        }
        assert!(items_iter.next().is_none());
    }

    #[test]
    fn crlf_terminated_lines() {
        let mut parser = StringTokenizer {};
        let content = b"a\r\nb\r\n";

        let mut items_iter = parser.parse(content, None).unwrap();

        let out1 = items_iter.next().unwrap();
        assert_eq!(out1.consumed, 3);
        match out1.message {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("a") => {}
            invalid => panic!("First message did not match: {invalid:?}"),
        }
        let out2 = items_iter.next().unwrap();
        assert_eq!(out2.consumed, 3);
        match out2.message {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("b") => {}
            invalid => panic!("Second message did not match: {invalid:?}"),
        }
        assert!(items_iter.next().is_none());
    }

    #[test]
    fn embedded_carriage_return_is_kept() {
        let mut parser = StringTokenizer {};

        let out = parser.parse(b"a\rb\n", None).unwrap().next().unwrap();

        match out.message {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("a\rb") => {}
            invalid => panic!("Message did not match: {invalid:?}"),
        }
    }

    #[test]
    fn remainder_keeps_trailing_carriage_return() {
        let mut parser = StringTokenizer {};

        let item = Parser::parse_remaining(&mut parser, b"a\r", None).unwrap();

        match item {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("a\r") => {}
            invalid => panic!("Remainder did not match: {invalid:?}"),
        }
    }

    #[test]
    fn invalid_utf8_becomes_replacement_char() {
        let mut parser = StringTokenizer {};

        // 0xF1 is `ñ` in the Windows-1252 sample of the user report.
        let out = parser.parse(b"a\xF1b\n", None).unwrap().next().unwrap();

        match out.message {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("a\u{FFFD}b") => {}
            invalid => panic!("Message did not match: {invalid:?}"),
        }
    }

    #[test]
    fn line_without_newline_is_incomplete() {
        let mut parser = StringTokenizer {};
        let content = b"{\"key\":\"value\"}";

        // The iterator of the success case has no `Debug`, so the error can't be unwrapped.
        let Err(err) = parser.parse(content, None) else {
            panic!("Input without a line break must not produce a line");
        };

        assert_matches!(err, Error::Incomplete);
    }

    #[test]
    fn empty_input_is_incomplete() {
        let mut parser = StringTokenizer {};

        let Err(err) = parser.parse(&[], None) else {
            panic!("Empty input must not produce a line");
        };

        assert_matches!(err, Error::Incomplete);
    }

    #[test]
    fn remainder_becomes_the_last_line() {
        let mut parser = StringTokenizer {};

        // Both traits are in scope in this module, so the call needs disambiguating.
        let item = Parser::parse_remaining(&mut parser, b"{\"key\":\"value\"}", None).unwrap();

        match item {
            Some(ParseYield::Message(StringMessage { content }))
                if content.eq("{\"key\":\"value\"}") => {}
            invalid => panic!("Remainder did not match: {invalid:?}"),
        }
    }
}
