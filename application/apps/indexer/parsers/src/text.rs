use crate::{Error, LogMessage, ParseYield, Parser};
use serde::Serialize;
use std::{fmt, io::Write, iter};

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

impl Parser<StringMessage> for StringTokenizer
where
    StringMessage: LogMessage,
{
    fn parse(
        &mut self,
        input: &[u8],
        _timestamp: Option<u64>,
    ) -> impl IntoIterator<Item = Result<(usize, Option<ParseYield<StringMessage>>), Error>> + Send
    {
        // TODO: support non-utf8 encodings
        use memchr::memchr;
        if input.is_empty() {
            return iter::once(Ok((input.len(), None)));
        }
        let res = if let Some(msg_size) = memchr(b'\n', input) {
            let content = String::from_utf8_lossy(&input[..msg_size]);
            let string_msg = StringMessage {
                content: content.to_string(),
            };
            Ok((msg_size + 1, Some(string_msg.into())))
        } else {
            Ok((
                input.len(),
                Some(ParseYield::from(StringMessage {
                    content: String::new(),
                })),
            ))
        };

        iter::once(res)
    }
}

#[test]
fn test_string_tokenizer() {
    let mut parser = StringTokenizer {};
    let content = b"hello\nworld\n";
    let (consumed_1, first_msg) = parser
        .parse(content, None)
        .into_iter()
        .next()
        .unwrap()
        .unwrap();
    match first_msg {
        Some(ParseYield::Message(StringMessage { content })) if content.eq("hello") => {}
        _ => panic!("First message did not match"),
    }
    let rest_1 = &content[consumed_1..];
    println!("rest_1 = {:?}", String::from_utf8_lossy(rest_1));
    let (consumed_2, second_msg) = parser
        .parse(rest_1, None)
        .into_iter()
        .next()
        .unwrap()
        .unwrap();
    match second_msg {
        Some(ParseYield::Message(StringMessage { content })) if content.eq("world") => {}
        _ => panic!("Second message did not match"),
    }
    let rest_2 = &rest_1[consumed_2..];
    let (consumed_3, third_msg) = parser
        .parse(rest_2, None)
        .into_iter()
        .next()
        .unwrap()
        .unwrap();
    println!(
        "rest_3 = {:?}",
        String::from_utf8_lossy(&rest_2[consumed_3..])
    );
    assert!(third_msg.is_none());
}
