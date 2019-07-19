#[cfg(test)]
mod tests {
    use crate::parse::*;

    use pretty_assertions::assert_eq;
    use regex::Regex;
    use std::path::PathBuf;
    use std::fs;

    #[test]
    fn test_date_parsers_escapes() {
        assert_eq!(
            date_expression("MM   .|?*+(){}[]^$DD"),
            Ok((
                "",
                vec![
                    FormatPiece::Month,
                    FormatPiece::Seperator(String::from(r"\s+\.\|\?\*\+\(\)\{}\[]\^\$")),
                    FormatPiece::Day
                ]
            ))
        );
    }
    #[test]
    fn test_format_parsers() {
        assert_eq!(
            date_expression("DD-MM ---> hh:mm:ss:s TZD"),
            Ok((
                "",
                vec![
                    FormatPiece::Day,
                    FormatPiece::Seperator(String::from("-")),
                    FormatPiece::Month,
                    FormatPiece::Seperator(String::from(r"\s+--->\s+")),
                    FormatPiece::Hour,
                    FormatPiece::Seperator(String::from(":")),
                    FormatPiece::Minute,
                    FormatPiece::Seperator(String::from(":")),
                    FormatPiece::Second,
                    FormatPiece::Seperator(String::from(":")),
                    FormatPiece::Fraction,
                    FormatPiece::Seperator(String::from(r"\s+")),
                    FormatPiece::TimeZone,
                ]
            ))
        );
        assert_eq!(
            date_expression("-YYYY"),
            Ok((
                "",
                vec![FormatPiece::Seperator("-".to_string()), FormatPiece::Year]
            ))
        );
        assert_eq!(
            date_expression("YYYY-"),
            Ok((
                "",
                vec![FormatPiece::Year, FormatPiece::Seperator("-".to_string())]
            ))
        );
        assert_eq!(
            date_expression("DDMM"),
            Ok(("", vec![FormatPiece::Day, FormatPiece::Month]))
        );
        assert_eq!(
            date_expression("DD:MM"),
            Ok((
                "",
                vec![
                    FormatPiece::Day,
                    FormatPiece::Seperator(String::from(":")),
                    FormatPiece::Month
                ]
            ))
        );
        assert_eq!(
            date_expression("MMDD"),
            Ok(("", vec![FormatPiece::Month, FormatPiece::Day]))
        );
    }

    #[test]
    fn test_date_format_str_to_regex1() {
        // 05-22 12:36:36.506 +0100 I/GKI_LINUX1
        let input = "DD-MM hh:mm:ss.s TZD";
        let regex = date_format_str_to_regex(input).expect("should be parsed");
        assert_eq!(Regex::new(r"(?P<d>\d{2})-(?P<m>\d{2})\s+(?P<H>\d{2}):(?P<M>\d{2}):(?P<S>\d{2})\.(?P<millis>\d+)\s+(?P<timezone>[\+\-]\d+)").unwrap().as_str(), regex.as_str());
    }
    #[test]
    fn test_date_format_str_to_regex2() {
        // 05-22-2019 12:36:04.344 A0
        let input2 = "DD-MM-YYYY hh:mm:ss.s";
        let regex2 = date_format_str_to_regex(input2).expect("should be parsed");
        assert_eq!(Regex::new(r"(?P<d>\d{2})-(?P<m>\d{2})-(?P<Y>\d{4})\s+(?P<H>\d{2}):(?P<M>\d{2}):(?P<S>\d{2})\.(?P<millis>\d+)").unwrap().as_str(), regex2.as_str());
    }
    #[test]
    fn test_date_format_str_to_regex_with_escape_characters() {
        // 05|22|2019
        let regex = date_format_str_to_regex("DD|MM|YYYY").expect("should be parsed");
        assert_eq!(
            Regex::new(r"(?P<d>\d{2})\|(?P<m>\d{2})\|(?P<Y>\d{4})")
                .unwrap()
                .as_str(),
            regex.as_str()
        );
    }
    #[test]
    fn test_date_format_str_to_regex_minus_after() {
        // 2019-
        let regex = date_format_str_to_regex("YYYY-").expect("should be parsed");
        assert_eq!(
            Regex::new(r"(?P<Y>\d{4})-").unwrap().as_str(),
            regex.as_str()
        );
    }
    #[test]
    fn test_date_format_str_to_regex_empty() {
        let regex = date_format_str_to_regex("");
        assert!(regex.is_err());
    }
    #[test]
    fn test_date_format_str_to_regex_other() {
        assert!(line_matching_format_expression("-YYYY", "-1997").unwrap_or(false));
        assert!(
            line_matching_format_expression("YYYY-MM-DDThh:mmTZD", "1997-07-16T19:20+01:00")
                .unwrap_or(false)
        );
        assert!(line_matching_format_expression("YYYY", "1997").unwrap_or(false));
        assert!(line_matching_format_expression("YYYY", "1997  some other crap").unwrap_or(false));
        assert!(
            line_matching_format_expression("YYYY", "something before: [1997]").unwrap_or(false)
        );

        // assert!(line_matching_format_expression("sss", "1559831467577").unwrap_or(false));

        assert!(line_matching_format_expression("YYYY-MM", "1997-07").unwrap_or(false));

        assert!(line_matching_format_expression("YYYY-MM-DD", "1997-07-16").unwrap_or(false));

        assert!(
            line_matching_format_expression("YYYY-MM-DDThh:mmTZD", "1997-07-16T19:20+01:00")
                .unwrap_or(false)
        );

        assert!(line_matching_format_expression(
            "YYYY-MM-DDThh:mm:ssTZD",
            "1997-07-16T19:20:30+01:00"
        )
        .unwrap_or(false));

        assert!(line_matching_format_expression(
            "YYYY-MM-DDThh:mm:ss.sTZD",
            "1997-07-16T19:20:30.45+01:00"
        )
        .unwrap_or(false));
        assert!(line_matching_format_expression(
            "YYYY-MM-DDThh:mm:ss.sTZD",
            "1997-07-16T19:20:30.45+01:00"
        )
        .unwrap_or(false));
        assert!(
            line_matching_format_expression("YYYYMMDDhhmmsssTZD", "1997071619203045+01:00")
                .unwrap_or(false)
        );
    }
    #[test]
    fn test_parse_date_line_no_year_with_timezone() {
        let input = "04-04 11:52:50.229 +0200 D/oup.csc(  665): [728] MqttLogger";
        let regex = date_format_str_to_regex("MM-DD hh:mm:ss.s TZD")
            .expect("format string should produce regex");

        let (timestamp, _) = to_posix_timestamp(input, &regex, Some(2017), None)
            .expect("convert to limed line should work");
        println!("timestamp: {}", timestamp);
        assert_eq!(1_491_299_570_229, timestamp);
    }
    #[test]
    fn test_parse_date_line_no_year_no_millis() {
        let input = "04-04 11:52:50 +0200 D/oup.csc(  665): [728] MqttLogger";
        let regex_to_use =
            date_format_str_to_regex("MM-DD hh:mm:ss TZD").expect("should be parsed");
        let (timestamp, _) = to_posix_timestamp(input, &regex_to_use, Some(2017), None)
            .expect("convert to limed line should work");
        assert_eq!(1_491_299_570_000, timestamp);
    }

    const TWO_HOURS_IN_MS: i64 = 2 * 3600 * 1000;
    #[test]
    fn test_parse_date_line_year_no_timezone() {
        let input =
            "04-04-2017 11:52:50.229 0 0.764564113869644 0.7033032911158661 0.807587397462308";
        let regex = date_format_str_to_regex("MM-DD-YYYY hh:mm:ss.s")
            .expect("format string should produce regex");
        let (timestamp, _) =
            to_posix_timestamp(input, &regex, None, Some(TWO_HOURS_IN_MS)).unwrap();
        assert_eq!(1_491_299_570_229, timestamp);
    }
    #[test]
    fn test_parse_date_line_only_millis() {
        let input = "1559831467577 some logging here...";
        let regex = date_format_str_to_regex("sss").expect("format string should produce regex");
        let (timestamp, _) = to_posix_timestamp(input, &regex, None, None).unwrap();
        assert_eq!(1_559_831_467_577, timestamp);
        let (timestamp_with_offset, _) =
            to_posix_timestamp(input, &regex, None, Some(-TWO_HOURS_IN_MS)).unwrap();
        assert_eq!(1_559_838_667_577, timestamp_with_offset);
    }

    test_generator::test_expand_paths! { test_detect_regex; "test_samples/detecting/*" }

    fn test_detect_regex(dir_name: &str) {
        let possible_formats: Vec<String> = vec![
            "MM-DD hh:mm:ss.s TZD".to_string(),
            "MM-DD-YYYY hh:mm:ss.s".to_string(),
        ];
        let in_path = PathBuf::from(&dir_name).join("in.log");
        let res = detect_timestamp_format(&in_path, &possible_formats)
            .expect("could not detect regex type");

        let mut format_path = PathBuf::from(&dir_name);
        format_path.push("expected.format");
        let contents =
            fs::read_to_string(format_path).expect("Something went wrong reading the file");
        let expected_format_string: String = contents.trim().to_string();
        assert_eq!(expected_format_string, res);
    }

}
