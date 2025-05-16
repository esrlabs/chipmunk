pub mod options;
use std::{borrow::Cow, io};

use definitions::*;
use serde::Serialize;
use stypes::NativeError;

pub struct StringTokenizer {}

#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct StringMessage {
    content: String,
}

// impl fmt::Display for StringMessage {
//     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
//         write!(f, "{}", self.content)
//     }
// }

// impl LogMessage for StringMessage {
//     fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
//         let len = self.content.len();
//         writer.write_all(self.content.as_bytes())?;
//         Ok(len)
//     }
// }

impl StringTokenizer {
    fn parse_item<'a>(
        &mut self,
        input: &'a [u8],
        _timestamp: Option<u64>,
    ) -> Result<(usize, Option<Cow<'a, str>>), ParserError> {
        // TODO: support non-utf8 encodings
        use memchr::memchr;
        if input.is_empty() {
            return Ok((input.len(), None));
        }
        let item = if let Some(msg_size) = memchr(b'\n', input) {
            let content = String::from_utf8_lossy(&input[..msg_size]);
            (msg_size + 1, Some(content))
        } else {
            (input.len(), Some(Cow::Borrowed("")))
        };

        Ok(item)
    }
}

impl Parser for StringTokenizer {
    fn parse<'a>(
        &mut self,
        input: &'a [u8],
        timestamp: Option<u64>,
    ) -> Result<(usize, Option<LogRecordOutput<'a>>), ParserError> {
        let (consumed, data) = self.parse_item(input, timestamp)?;
        Ok((consumed, data.map(|msg| LogRecordOutput::Cow(msg))))
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
        let (consumed_1, first_msg) = parser.parse_item(content, None).unwrap();
        match first_msg {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("hello") => {}
            _ => panic!("First message did not match"),
        }
        let rest_1 = &content[consumed_1..];
        println!("rest_1 = {:?}", String::from_utf8_lossy(rest_1));
        let (consumed_2, second_msg) = parser.parse_item(rest_1, None).unwrap();
        match second_msg {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("world") => {}
            _ => panic!("Second message did not match"),
        }
        let rest_2 = &rest_1[consumed_2..];
        let (consumed_3, third_msg) = parser.parse_item(rest_2, None).unwrap();
        println!(
            "rest_3 = {:?}",
            String::from_utf8_lossy(&rest_2[consumed_3..])
        );
        assert!(third_msg.is_none());
    }

    #[test]
    fn one_parse_call() {
        let mut parser = StringTokenizer {};
        let content = b"hello\nworld\n";
        let mut items_iter = parser.parse(content, None).unwrap();

        let (_consumed_1, first_msg) = items_iter.next().unwrap();
        match first_msg {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("hello") => {}
            _ => panic!("First message did not match"),
        }
        let (_consumed_2, second_msg) = items_iter.next().unwrap();
        match second_msg {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("world") => {}
            _ => panic!("Second message did not match"),
        }
        assert!(items_iter.next().is_none());
    }
}
