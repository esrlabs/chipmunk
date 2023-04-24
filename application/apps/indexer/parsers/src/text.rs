use crate::{Error, LogMessage, ParseYield, Parser};
use serde::Serialize;
use std::{fmt, io::Write};

pub struct StringTokenizer;

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

impl Parser<StringMessage> for StringTokenizer
where
    StringMessage: LogMessage,
{
    fn parse<'b>(
        &mut self,
        input: &'b [u8],
        _timestamp: Option<u64>,
    ) -> Result<(&'b [u8], Option<ParseYield<StringMessage>>), Error> {
        // TODO: support non-utf8 encodings
        use memchr::memchr;
        if input.is_empty() {
            return Ok((input, None));
        }
        if let Some(msg_size) = memchr(b'\n', input) {
            let content = String::from_utf8_lossy(&input[..msg_size]);
            let string_msg = StringMessage {
                content: content.to_string(),
            };
            Ok((&input[msg_size + 1..], Some(string_msg.into())))
        } else {
            Ok((
                &[],
                Some(ParseYield::from(StringMessage {
                    content: String::new(),
                })),
            ))
        }
    }
}

#[test]
fn test_string_tokenizer() {
    let mut parser = StringTokenizer;
    let content = b"hello\nworld\n";
    let (rest_1, first_msg) = parser.parse(content, None).unwrap();
    match first_msg {
        Some(ParseYield::Message(StringMessage { content })) if content.eq("hello") => {}
        _ => panic!("First message did not match"),
    }
    println!("rest_1 = {:?}", String::from_utf8_lossy(rest_1));
    let (rest_2, second_msg) = parser.parse(rest_1, None).unwrap();
    match second_msg {
        Some(ParseYield::Message(StringMessage { content })) if content.eq("world") => {}
        _ => panic!("Second message did not match"),
    }
    let (rest_3, third_msg) = parser.parse(rest_2, None).unwrap();
    println!("rest_3 = {:?}", String::from_utf8_lossy(rest_3));
    assert!(third_msg.is_none());
}
