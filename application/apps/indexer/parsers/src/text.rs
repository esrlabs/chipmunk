use crate::{Error, LogMessage, ParseYield, SingleParser};
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

impl SingleParser<StringMessage> for StringTokenizer
where
    StringMessage: LogMessage,
{
    fn parse_item(
        &mut self,
        input: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<(usize, Option<ParseYield<StringMessage>>), Error> {
        // TODO: support non-utf8 encodings
        use memchr::memchr;
        if input.is_empty() {
            return Ok((input.len(), None));
        }
        let item = if let Some(msg_size) = memchr(b'\n', input) {
            let content = String::from_utf8_lossy(&input[..msg_size]);
            let string_msg = StringMessage {
                content: content.to_string(),
            };
            (msg_size + 1, Some(string_msg.into()))
        } else {
            (
                input.len(),
                Some(ParseYield::from(StringMessage {
                    content: String::new(),
                })),
            )
        };

        Ok(item)
    }
}

impl Parser<StringMessage> for StringTokenizer
where
    StringMessage: LogMessage,
{
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = (usize, Option<ParseYield<StringMessage>>)>, Error> {
        parse_all(input, timestamp, MIN_MSG_LEN, |input, timestamp| {
            self.parse_item(input, timestamp)
        })
    }
}

const TEXT_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03, 0x03,
]);

impl components::Component for StringTokenizer {
    fn ident() -> stypes::Ident {
        stypes::Ident {
            name: String::from("Text Parser"),
            desc: String::from("Text Parser"),
            uuid: TEXT_PARSER_UUID,
        }
    }
    fn register(_components: &mut components::Components) -> Result<(), stypes::NativeError> {
        Ok(())
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
