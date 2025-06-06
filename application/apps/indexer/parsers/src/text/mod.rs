pub mod descriptor;
use std::borrow::Cow;

use definitions::*;
use serde::Serialize;

/// The most likely minimal bytes count needed to parse a text message.
const MIN_MSG_LEN: usize = 1;

pub struct StringTokenizer {}

#[derive(Debug, PartialEq, Eq, Serialize)]
pub struct StringMessage {
    content: String,
}

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
    fn min_msg_len(&self) -> usize {
        MIN_MSG_LEN
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn multiple_parse_calls() {
        let mut parser = StringTokenizer {};
        let content = b"hello\nworld\n";
        let (consumed_1, first_msg) = parser.parse(content, None).unwrap().next().unwrap();
        match first_msg {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("hello") => {}
            _ => panic!("First message did not match"),
        }
        let rest_1 = &content[consumed_1..];
        println!("rest_1 = {:?}", String::from_utf8_lossy(rest_1));
        let (consumed_2, second_msg) = parser.parse(rest_1, None).unwrap().next().unwrap();
        match second_msg {
            Some(ParseYield::Message(StringMessage { content })) if content.eq("world") => {}
            _ => panic!("Second message did not match"),
        }
        let rest_2 = &rest_1[consumed_2..];
        let (consumed_3, third_msg) = parser.parse(rest_2, None).unwrap().next().unwrap();
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
