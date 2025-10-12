use crate::{Error, LogMessage, ParseOutput, ParseYield, SingleParser};
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
        let item = if let Some(msg_size) = memchr(b'\n', input) {
            let content = String::from_utf8_lossy(&input[..msg_size]);
            let string_msg = StringMessage {
                content: content.to_string(),
            };
            ParseOutput::new(msg_size + 1, Some(string_msg.into()))
        } else {
            ParseOutput::new(
                input.len(),
                Some(ParseYield::from(StringMessage {
                    content: String::new(),
                })),
            )
        };

        Ok(item)
    }
}

#[cfg(test)]
mod tests {
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
}
