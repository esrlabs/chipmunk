use std::{
    fmt::{self, Display},
    net::Ipv4Addr,
};

use nom::{
    Finish, IResult,
    combinator::map,
    number::streaming::{be_u8, be_u16, be_u32},
    sequence::tuple,
};

use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Incomplete, not enough data for a message")]
    Incomplete,
}

impl nom::error::ParseError<&[u8]> for Error {
    fn from_error_kind(input: &[u8], kind: nom::error::ErrorKind) -> Self {
        Error::Parse(format!(
            "Nom error: {:?} ({} bytes left)",
            kind,
            input.len()
        ))
    }

    fn append(_: &[u8], _: nom::error::ErrorKind, other: Self) -> Self {
        other
    }
}

/// Parses a DLT Network-Trace prefix for a SOME/IP message from the given input.
///
/// A valid prefix will consist of:
/// - 4 bytes as IPv4 address
/// - 2 bytes as udp/tcp port
/// - 1 byte as protocol type (0 = local, 1 = tcp, 2 = udp)
/// - 1 byte as message direction (0 = incoming, 1 = outgoing)
/// - 1, 2 or 4 bytes as instance-id
pub fn parse_prefix(input: &[u8]) -> Result<(&[u8], std::string::String), Error> {
    map(
        tuple((be_u32, be_u16, be_u8, be_u8, parse_instance)),
        |(address, port, proto, direction, instance)| {
            format!(
                "{}:{}{} INST:{}{}",
                Ipv4Addr::from(address),
                port,
                Direction::try_from(direction)
                    .ok()
                    .map_or_else(String::default, |s| format!(" {}", s)),
                instance,
                Proto::try_from(proto)
                    .ok()
                    .map_or_else(String::default, |s| format!(" {}", s))
            )
        },
    )(input)
    .finish()
}

fn parse_instance(input: &[u8]) -> IResult<&[u8], usize, Error> {
    match input.len() {
        1 => map(be_u8, |i| i as usize)(input),
        2 => map(be_u16, |i| i as usize)(input),
        4 => map(be_u32, |i| i as usize)(input),
        _ => Err(nom::Err::Error(Error::Incomplete)),
    }
}

enum Direction {
    Incoming,
    Outgoing,
}

impl Display for Direction {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Direction::Incoming => write!(f, "<<"),
            Direction::Outgoing => write!(f, ">>"),
        }
    }
}

impl TryFrom<u8> for Direction {
    type Error = ();

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Direction::Incoming),
            1 => Ok(Direction::Outgoing),
            _ => Err(()),
        }
    }
}

enum Proto {
    Local,
    Tcp,
    Udp,
}

impl Display for Proto {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Proto::Local => write!(f, "LOCAL"),
            Proto::Tcp => write!(f, "TCP"),
            Proto::Udp => write!(f, "UDP"),
        }
    }
}

impl TryFrom<u8> for Proto {
    type Error = ();

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Proto::Local),
            1 => Ok(Proto::Tcp),
            2 => Ok(Proto::Udp),
            _ => Err(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_prefix() {
        let input = [0x7F, 0x00, 0x00, 0x01, 0x30, 0x39, 0x01, 0x00, 0x01];
        let result = parse_prefix(&input).expect("prefix");
        assert_eq!("127.0.0.1:12345 << INST:1 TCP", result.1);

        let input = [0x7F, 0x00, 0x00, 0x01, 0x30, 0x39, 0x02, 0x01, 0x00, 0x01];
        let result = parse_prefix(&input).expect("prefix");
        assert_eq!("127.0.0.1:12345 >> INST:1 UDP", result.1);

        let input = [
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x01,
        ];
        let result = parse_prefix(&input).expect("prefix");
        assert_eq!("0.0.0.0:0 INST:1", result.1);

        let input = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
        assert!(parse_prefix(&input).is_err())
    }
}
