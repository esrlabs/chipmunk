use nom::*;

// 05-22 12:36:36.506 +0100 I/GKI_LINUX1
// r"(?x)^(?P<m>\d{2})-(?P<d>\d{2})\s+(?P<H>\d{2}):(?P<M>\d{2}):(?P<S>\d{2}).(?P<millis>\d+)\s(?P<timezone>[\+\-]\d+)"

// r"(?x)^(?P<m>\d{2})-(?P<d>\d{2})-(?P<Y>\d{4})\s+(?P<H>\d{2}):(?P<M>\d{2}):(?P<S>\d{2}).(?P<millis>\d+)",
// 05-22-2019 12:36:04.344 A0

#[derive(Debug, PartialEq)]
pub struct Line {
    pub month: u16,
    pub day: u16,
    pub year: u16,
}

fn from_digits(input: &str) -> Result<u16, std::num::ParseIntError> {
    u16::from_str_radix(input, 10)
}

fn is_digit(c: char) -> bool {
    c.is_digit(10)
}
named!(match_ws<char>, char!(' '));
named!(num_primary<&str, u16>,
  map_res!(take_while_m_n!(2, 2, is_digit), from_digits)
);
named!(num_primary4<&str, u16>,
  map_res!(take_while_m_n!(4, 4, is_digit), from_digits)
);

named!(date_parser<&str, Line>,
  do_parse!(
    month:   num_primary >>
    tag!("-")   >>
    day: num_primary >>
    tag!("-")   >>
    year:  num_primary4 >>
    // opt!(tag!(" ")) >>
    (Line { month, day, year })
  )
);

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;
    #[test]
    fn basic() {
        assert_eq!(
            // 05-22-2019 12:36:04.344 A0
            date_parser("05-14-2019"),
            Ok((
                "",
                Line {
                    month: 5,
                    day: 14,
                    year: 2019,
                }
            ))
        );
    }
}
