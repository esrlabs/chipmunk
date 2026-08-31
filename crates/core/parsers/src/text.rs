use crate::{Error, LogMessage, ParseOutput, ParseYield, RemainderError, SingleParser};
use serde::Serialize;
use std::{fmt, io::Write};

pub struct StringTokenizer {}

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

impl SingleParser for StringTokenizer {
    type Output = StringMessage;

    fn parse_item(
        &mut self,
        input: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<ParseOutput<StringMessage>, Error> {
        // TODO: support non-utf8 encodings
        use memchr::memchr;
        if input.is_empty() {
            return Ok(ParseOutput::new(input.len(), None));
        }
        // Without a line break the input is the start of a line and not a line: reporting it as
        // one would split every line that straddles a source buffer boundary.
        let Some(msg_size) = memchr(b'\n', input) else {
            return Err(Error::Incomplete);
        };

        let content = String::from_utf8_lossy(&input[..msg_size]);
        let string_msg = StringMessage {
            content: content.into_owned(),
        };

        let output = ParseOutput::new(msg_size + 1, Some(string_msg.into()));

        Ok(output)
    }

    fn parse_remaining(
        &mut self,
        input: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<Option<ParseYield<StringMessage>>, RemainderError> {
        // No more bytes are coming, so the unterminated line is the last line.
        let content = String::from_utf8_lossy(input);
        let string_msg = StringMessage {
            content: content.into_owned(),
        };

        Ok(Some(string_msg.into()))
    }
}

#[cfg(test)]
mod tests {
    use std::assert_matches;

    use crate::Parser;

    use super::*;

    #[test]
    fn multiple_parse_calls() {
        let mut parser = StringTokenizer {};
        let content = b"hello\nworld\n";
        let out1 = parser.parse_item(content, None).unwrap();
        match out1.message {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("hello") => {}
            _ => panic!("First message did not match"),
        }
        let rest_1 = &content[out1.consumed..];
        println!("rest_1 = {:?}", String::from_utf8_lossy(rest_1));
        let out2 = parser.parse_item(rest_1, None).unwrap();
        match out2.message {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("world") => {}
            _ => panic!("Second message did not match"),
        }
        let rest_2 = &rest_1[out2.consumed..];
        let out3 = parser.parse_item(rest_2, None).unwrap();
        println!(
            "rest_3 = {:?}",
            String::from_utf8_lossy(&rest_2[out3.consumed..])
        );
        assert!(out3.message.is_none());
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
    fn line_without_newline_is_incomplete() {
        let mut parser = StringTokenizer {};
        let content = b"{\"key\":\"value\"}";

        let err = parser.parse_item(content, None).unwrap_err();

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
