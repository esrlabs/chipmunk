#[allow(clippy::cognitive_complexity)]
#[cfg(test)]
mod tests {
    use crate::parse::*;

    use chrono::{naive::NaiveDate, Datelike, Utc};
    use pretty_assertions::assert_eq;
    use proptest::prelude::*;
    use std::{fs, path::PathBuf};

    static VALID_TIMESTAMP_FORMAT: &str = "[+-]{1}[0-9]{2}[0-5]{1}[0-9]{1}";

    fn init() {
        if std::env::var("RUST_LOG").is_err() {
            std::env::set_var(
                "RUST_LOG",
                "warn,processor::parse=trace,processor::tests=trace",
            );
        }
        let _ = env_logger::builder().is_test(true).try_init();
    }

    proptest! {
        #[test]
        fn offset_from_timezone_in_ms_doesnt_crash(s in "\\PC*") {
            let _ = parse_timezone(&s);
        }
        #[test]
        fn parses_all_valid_dates(s in VALID_TIMESTAMP_FORMAT) {
            parse_timezone(&s).unwrap();
        }
    }

    #[test]
    fn test_date_parsers() {
        assert_eq!(any_date_format("MMM23"), Ok(("23", FormatPiece::MonthName)));
        assert_eq!(any_date_format("DD23"), Ok(("23", FormatPiece::Day)));
        assert_eq!(
            any_date_format("sss23"),
            Ok(("23", FormatPiece::AbsoluteMilliseconds))
        );
        assert_eq!(any_date_format("MM23"), Ok(("23", FormatPiece::Month)));
        assert_eq!(any_date_format("DDMM"), Ok(("MM", FormatPiece::Day)));
        assert_eq!(any_date_format("YYYY-"), Ok(("-", FormatPiece::Year)));
        assert_eq!(any_date_format("yy-"), Ok(("-", FormatPiece::YearShort)));

        assert_eq!(
            any_date_format("-YYYY"),
            Ok(("YYYY", FormatPiece::SeperatorChar('-')))
        );
    }

    #[test]
    fn test_offset_from_timezone_in_ms_non_ascii() {
        assert!(parse_timezone("aࡠA").is_err());
    }
    #[test]
    fn test_offset_from_timezone_in_ms_invalid_input() {
        assert!(parse_timezone("0Aaa0").is_err());
    }

    #[test]
    fn test_timezone_parser() {
        if let Ok(res) = parse_timezone("+01:00") {
            dbg!(res);
        } else {
            println!("could not parse");
        }
    }
    #[test]
    fn test_offset_from_timezone_in_ms() {
        assert_eq!(0, parse_timezone("+0000").expect("could not parse"));
        assert_eq!(0, parse_timezone("-0000").expect("could not parse"));
        assert_eq!(
            2 * 3600 * 1000,
            parse_timezone("+0200").expect("could not parse")
        );
        assert_eq!(
            2 * 3600 * 1000,
            parse_timezone("+02:00").expect("could not parse")
        );
        assert_eq!(
            2 * 3600 * 1000 + 30 * 60 * 1000,
            parse_timezone("+0230").expect("could not parse")
        );
        assert_eq!(
            -2 * 3600 * 1000,
            parse_timezone("-0200").expect("could not parse")
        );
        assert_eq!(
            -30 * 60 * 1000,
            parse_timezone("-00:30").expect("could not parse")
        );
    }

    #[test]
    fn test_date_parsers_escapes() {
        assert_eq!(
            date_expression("MM   .|?*+(){}[]^$DD"),
            Ok((
                "",
                vec![
                    FormatPiece::Month,
                    FormatPiece::Seperator(String::from(r"\s?\.\|\?\*\+\(\)\{}\[]\^\$")),
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
                    FormatPiece::Seperator(String::from(r"\s?--->\s?")),
                    FormatPiece::Hour,
                    FormatPiece::Seperator(String::from(":")),
                    FormatPiece::Minute,
                    FormatPiece::Seperator(String::from(":")),
                    FormatPiece::Second,
                    FormatPiece::Seperator(String::from(":")),
                    FormatPiece::Fraction,
                    FormatPiece::Seperator(String::from(r"\s?")),
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
    fn test_date_format_str_to_regex_empty() {
        let regex = lookup_regex_for_format_str("");
        assert!(regex.is_err());
    }
    #[test]
    fn test_full_timestamp_parser() {
        let input = "109.169.248.247 - - [13/Dec/2015:18:25:11 +0100] GET /administrator";
        let regex = lookup_regex_for_format_str("DD/MMM/YYYY:hh:mm:ss TZD").unwrap();
        let res = parse_full_timestamp(input, &regex);
        if let Ok((expected, _, _)) = detect_timestamp_in_string(input, None) {
            if let Ok((time, _)) = res {
                assert_eq!(expected, time);
                println!("{}", posix_timestamp_as_string(time));
            }
        };
        println!("res: {res:?}");
    }
    #[test]
    fn test_parse_date_line_no_year_with_timezone() {
        let input = "04-04 11:52:50.229 +0200 D/oup.csc(  665): [728] MqttLogger";
        let regex = lookup_regex_for_format_str("MM-DD hh:mm:ss.s TZD")
            .expect("format string should produce regex");
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: Some(2017),
            offset: Some(TWO_HOURS_IN_MS),
        };
        let (timestamp, _) = extract_posix_timestamp(input, &regex, replacements)
            .expect("convert to limed line should work");
        assert_eq!(
            NaiveDate::from_ymd_opt(2017, 4, 4)
                .expect("incorrect format")
                .and_hms_opt(9, 52, 50) // UTC
                .expect("incorrect format")
                .timestamp()
                * 1000
                + 229,
            timestamp
        );
    }
    #[test]
    fn test_parse_date_line_no_year_no_millis() {
        let input = "04-04 11:52:50 +0200 D/oup.csc(  665): [728] MqttLogger";
        let regex_to_use =
            lookup_regex_for_format_str("MM-DD hh:mm:ss TZD").expect("should be parsed");
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: Some(2017),
            offset: Some(TWO_HOURS_IN_MS),
        };
        let (timestamp, _) = extract_posix_timestamp(input, &regex_to_use, replacements)
            .expect("convert to limed line should work");
        assert_eq!(
            NaiveDate::from_ymd_opt(2017, 4, 4)
                .expect("incorrect format")
                .and_hms_opt(9, 52, 50) // UTC
                .expect("incorrect format")
                .timestamp()
                * 1000,
            timestamp
        );
    }

    const TWO_HOURS_IN_MS: i64 = 2 * 3600 * 1000;
    const THIRTY_MIN_IN_MS: i64 = 30 * 60 * 1000;
    const FIVE_HOURS_THIRTY_MIN_IN_MS: i64 = 330 * 60 * 1000;
    #[test]
    fn test_parse_date_line_year_no_timezone() {
        let input =
            "04-04-2017 11:52:50.229 0 0.764564113869644 0.7033032911158661 0.807587397462308";
        let regex = lookup_regex_for_format_str("MM-DD-YYYY hh:mm:ss.s")
            .expect("format string should produce regex");
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: None,
            offset: Some(TWO_HOURS_IN_MS),
        };
        let (timestamp, _) = extract_posix_timestamp(input, &regex, replacements).unwrap();
        assert_eq!(
            NaiveDate::from_ymd_opt(2017, 4, 4)
                .expect("incorrect format")
                .and_hms_opt(9, 52, 50) // UTC
                .expect("incorrect format")
                .timestamp()
                * 1000
                + 229,
            timestamp
        );
    }
    #[test]
    fn test_parse_date_line_with_short_month_str() {
        let input = "109.169.248.247 - - [04/Apr/2017:11:52:50 +0200] xyz";
        let regex = lookup_regex_for_format_str("DD/MMM/YYYY:hh:mm:ss TZD")
            .expect("format string should produce regex");
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: None,
            offset: Some(TWO_HOURS_IN_MS),
        };
        let (timestamp, _) = extract_posix_timestamp(input, &regex, replacements).unwrap();
        assert_eq!(
            NaiveDate::from_ymd_opt(2017, 4, 4)
                .expect("incorrect format")
                .and_hms_opt(9, 52, 50) // UTC
                .expect("incorrect format")
                .timestamp()
                * 1000,
            timestamp
        );
    }

    #[test]
    fn test_parse_date_problem_case() {
        let input = "[2019-07-30T10:08:02.555][DEBUG][indexing]: xyz";
        let regex = lookup_regex_for_format_str("YYYY-MM-DDThh:mm:ss.s")
            .expect("format string should produce regex");
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: None,
            offset: Some(TWO_HOURS_IN_MS),
        };
        let (timestamp, _) = extract_posix_timestamp(input, &regex, replacements).unwrap();
        assert_eq!(
            NaiveDate::from_ymd_opt(2019, 7, 30)
                .expect("incorrect format")
                .and_hms_opt(8, 8, 2) // UTC
                .expect("incorrect format")
                .timestamp()
                * 1000
                + 555,
            timestamp
        );
    }

    #[test]
    fn test_parse_date_only_time() {
        init();
        let input = "2019-07-19 16:14:57.979: TIME: INFO: [TimeManagement] Timesync done: dt=1562948097296ms (flash=1562948095650ms, ble=2329ms";
        let regex = lookup_regex_for_format_str("YYYY-MM-DD hh:mm")
            .expect("format string should produce regex");
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: None,
            offset: Some(0),
        };
        let (timestamp, _) = extract_posix_timestamp(input, &regex, replacements).unwrap();
        assert_eq!(
            NaiveDate::from_ymd_opt(2019, 7, 19)
                .expect("incorrect format")
                .and_hms_opt(16, 14, 0)
                .expect("incorrect format")
                .timestamp()
                * 1000,
            timestamp
        );
    }

    #[test]
    fn test_parse_date_line_only_millis() {
        let input = "1559831467577 some logging here...";
        let regex = lookup_regex_for_format_str("sss").expect("format string should produce regex");
        let mut replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: None,
            offset: None,
        };
        let (timestamp, _) = extract_posix_timestamp(input, &regex, replacements.clone()).unwrap();
        assert_eq!(1_559_831_467_577, timestamp);
        replacements = DateTimeReplacements {
            day: None,
            month: None,
            year: None,
            offset: Some(-TWO_HOURS_IN_MS),
        };
        let (timestamp_with_offset, _) =
            extract_posix_timestamp(input, &regex, replacements).unwrap();
        assert_eq!(1_559_838_667_577, timestamp_with_offset);
    }

    #[test]
    fn test_parse_date_line_no_year_with_timezone_by_format() {
        let input = "04-04 11:52:50.229 +0200 D/oup.csc(  665): [728] MqttLogger";
        let format = "MM-DD hh:mm:ss.s TZD";
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: Some(2017),
            offset: Some(TWO_HOURS_IN_MS),
        };
        if let TimestampByFormatResult::Timestamp(tm) =
            extract_posix_timestamp_by_format(input, format, replacements)
        {
            assert_eq!(
                NaiveDate::from_ymd_opt(2017, 4, 4)
                    .expect("incorrect format")
                    .and_hms_opt(9, 52, 50) // UTC
                    .expect("incorrect format")
                    .timestamp()
                    * 1000
                    + 229,
                tm
            );
        }
    }

    #[test]
    fn test_parse_date_line_no_year_no_millis_by_format() {
        let input = "04-04 11:52:50 +0200 D/oup.csc(  665): [728] MqttLogger";
        let format = "MM-DD hh:mm:ss TZD";
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: Some(2017),
            offset: Some(TWO_HOURS_IN_MS),
        };
        if let TimestampByFormatResult::Timestamp(tm) =
            extract_posix_timestamp_by_format(input, format, replacements)
        {
            assert_eq!(
                NaiveDate::from_ymd_opt(2017, 4, 4)
                    .expect("incorrect format")
                    .and_hms_opt(9, 52, 50) // UTC
                    .expect("incorrect format")
                    .timestamp()
                    * 1000,
                tm
            );
        }
    }

    #[test]
    fn test_parse_date_line_year_no_timezone_by_format() {
        let input =
            "04-04-2017 11:52:50.229 0 0.764564113869644 0.7033032911158661 0.807587397462308";
        let format = "MM-DD-YYYY hh:mm:ss.s";
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: None,
            offset: Some(TWO_HOURS_IN_MS),
        };
        if let TimestampByFormatResult::Timestamp(tm) =
            extract_posix_timestamp_by_format(input, format, replacements)
        {
            assert_eq!(
                NaiveDate::from_ymd_opt(2017, 4, 4)
                    .expect("incorrect format")
                    .and_hms_opt(9, 52, 50) // UTC
                    .expect("incorrect format")
                    .timestamp()
                    * 1000
                    + 229,
                tm
            );
        }
    }

    #[test]
    fn test_parse_date_line_with_short_month_str_by_format() {
        let input = "109.169.248.247 - - [04/Apr/2017:11:52:50 +0200] xyz";
        let format = "DD/MMM/YYYY:hh:mm:ss TZD";
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: None,
            offset: Some(TWO_HOURS_IN_MS),
        };
        if let TimestampByFormatResult::Timestamp(tm) =
            extract_posix_timestamp_by_format(input, format, replacements)
        {
            assert_eq!(
                NaiveDate::from_ymd_opt(2017, 4, 4)
                    .expect("incorrect format")
                    .and_hms_opt(9, 52, 50) // UTC
                    .expect("incorrect format")
                    .timestamp()
                    * 1000,
                tm
            );
        }
    }

    #[test]
    fn test_parse_date_problem_case_by_format() {
        let input = "[2019-07-30T10:08:02.555][DEBUG][indexing]: xyz";
        let format = "YYYY-MM-DDThh:mm:ss.s";
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: None,
            offset: Some(TWO_HOURS_IN_MS),
        };
        if let TimestampByFormatResult::Timestamp(tm) =
            extract_posix_timestamp_by_format(input, format, replacements)
        {
            assert_eq!(
                NaiveDate::from_ymd_opt(2019, 7, 30)
                    .expect("incorrect format")
                    .and_hms_opt(8, 8, 2) // UTC
                    .expect("incorrect format")
                    .timestamp()
                    * 1000
                    + 555,
                tm
            );
        }
    }

    #[test]
    fn test_parse_date_only_time_by_format() {
        init();
        let input = "2019-07-19 16:14:57.979: TIME: INFO: [TimeManagement] Timesync done: dt=1562948097296ms (flash=1562948095650ms, ble=2329ms";
        let format = "YYYY-MM-DD hh:mm";
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: None,
            offset: Some(0),
        };
        if let TimestampByFormatResult::Timestamp(tm) =
            extract_posix_timestamp_by_format(input, format, replacements)
        {
            assert_eq!(
                NaiveDate::from_ymd_opt(2019, 7, 19)
                    .expect("incorrect format")
                    .and_hms_opt(16, 14, 0)
                    .expect("incorrect format")
                    .timestamp()
                    * 1000,
                tm
            );
        }
    }

    #[test]
    fn test_parse_date_only_time_by_not_full_format() {
        init();
        let input = "16:14:57.979: TIME: INFO: [TimeManagement] Timesync done: dt=1562948097296ms (flash=1562948095650ms, ble=2329ms";
        let format = "hh:mm:ss";
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: Some(19),
            month: Some(7),
            year: Some(2019),
            offset: Some(0),
        };
        if let TimestampByFormatResult::Timestamp(tm) =
            extract_posix_timestamp_by_format(input, format, replacements)
        {
            assert_eq!(
                NaiveDate::from_ymd_opt(2019, 7, 19)
                    .expect("incorrect format")
                    .and_hms_opt(16, 14, 57)
                    .expect("incorrect format")
                    .timestamp()
                    * 1000,
                tm
            );
        }
    }

    #[test]
    fn test_parse_date_line_only_millis_by_format() {
        let input = "1559831467577 some logging here...";
        let format = "sss";
        let replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: None,
            offset: Some(0),
        };
        if let TimestampByFormatResult::Timestamp(tm) =
            extract_posix_timestamp_by_format(input, format, replacements)
        {
            assert_eq!(1_559_831_467_577, tm);
        }
    }

    macro_rules! derive_format_and_check {
        ($input:expr, $exp:expr) => {
            match detect_timeformat_in_string($input, None) {
                Ok(format) => {
                    println!("found format was: {}", format);
                    assert_eq!($exp, format)
                }
                Err(e) => panic!("error happened in detection: {}", e),
            }
            assert!(line_matching_format_expression($exp, $input).unwrap_or(false));
        };
    }
    macro_rules! match_format {
        ($example:expr, $format:expr) => {
            assert!(line_matching_format_expression($format, $example).unwrap_or(false));
        };
    }
    macro_rules! no_match_format {
        ($format:expr, $example:expr) => {
            assert!(
                !line_matching_format_expression($format, $example).unwrap_or(true),
                "should not match"
            );
        };
    }
    // yyyy-MM-dd'T'HH:mm:ss*SSSZZZZ	2018-08-20'T'13:20:10*633+0000
    // yyyy MMM dd HH:mm:ss.SSS zzz	2017 Mar 03 05:12:41.211 PDT
    // MMM dd HH:mm:ss ZZZZ yyyy	Jan 21 18:20:11 +0000 2017
    // dd/MMM/yyyy:HH:mm:ss ZZZZ	19/Apr/2017:06:36:15 -0700
    // MMM dd, yyyy hh:mm:ss a	Dec 2, 2017 2:39:58 AM
    // MMM dd yyyy HH:mm:ss	Jun 09 2018 15:28:14
    // MMM dd HH:mm:ss yyyy	Apr 20 00:00:35 2010
    // MMM dd HH:mm:ss ZZZZ	Sep 28 19:00:00 +0000
    // MMM dd HH:mm:ss	Mar 16 08:12:04
    // yyyy-MM-dd'T'HH:mm:ssZZZZ	2017-10-14T22:11:20+0000
    // yyyy-MM-dd'T'HH:mm:ss.SSS'Z'	2017-07-01T14:59:55.711'+0000'
    // 2017-07-01T14:59:55.711Z
    // yyyy-MM-dd HH:mm:ss ZZZZ	2017-08-19 12:17:55 -0400
    // yyyy-MM-dd HH:mm:ssZZZZ	2017-08-19 12:17:55-0400
    // yyyy-MM-dd HH:mm:ss,SSS	2017-06-26 02:31:29,573
    // yyyy/MM/dd*HH:mm:ss	2017/04/12*19:37:50
    // yyyy MMM dd HH:mm:ss.SSS*zzz	2018 Apr 13 22:08:13.211*PDT
    // yyyy MMM dd HH:mm:ss.SSS	2017 Mar 10 01:44:20.392
    // yyyy-MM-dd HH:mm:ss,SSSZZZZ	2017-03-10 14:30:12,655+0000
    // yyyy-MM-dd HH:mm:ss.SSS	2018-02-27 15:35:20.311
    // yyyy-MM-dd HH:mm:ss.SSSZZZZ	2017-03-12 13:11:34.222-0700
    // yyyy-MM-dd'T'HH:mm:ss.SSS	2017-07-22'T'16:28:55.444
    // yyyy-MM-dd'T'HH:mm:ss	2017-09-08'T'03:13:10
    // yyyy-MM-dd'T'HH:mm:ss'Z'	2017-03-12'T'17:56:22'-0700'
    // yyyy-MM-dd'T'HH:mm:ss.SSS	2017-11-22'T'10:10:15.455
    // yyyy-MM-dd'T'HH:mm:ss	2017-02-11'T'18:31:44
    // yyyy-MM-dd*HH:mm:ss:SSS	2017-10-30*02:47:33:899
    // yyyy-MM-dd*HH:mm:ss	2017-07-04*13:23:55
    // yy-MM-dd HH:mm:ss,SSS ZZZZ	11-02-11 16:47:35,985 +0000
    // yy-MM-dd HH:mm:ss,SSS	10-06-26 02:31:29,573
    // yy-MM-dd HH:mm:ss	10-04-19 12:00:17
    // yy/MM/dd HH:mm:ss	06/01/22 04:11:05
    // yyMMdd HH:mm:ss	150423 11:42:35
    // yyyyMMdd HH:mm:ss.SSS	20150423 11:42:35.173
    // MM/dd/yy*HH:mm:ss	08/10/11*13:33:56
    // MM/dd/yyyy*HH:mm:ss	11/22/2017*05:13:11
    // MM/dd/yyyy*HH:mm:ss*SSS	05/09/2017*08:22:14*612
    // HH:mm:ss	11:42:35
    // HH:mm:ss.SSS	11:42:35.173
    // HH:mm:ss,SSS	11:42:35,173
    // dd/MMM HH:mm:ss,SSS	23/Apr 11:42:35,173
    // dd-MMM-yyyy HH:mm:ss.SSS	23-Apr-2017 11:42:35.883
    // dd MMM yyyy HH:mm:ss*SSS	23 Apr 2017 10:32:35*311
    // MMdd_HH:mm:ss	0423_11:42:35
    // MMdd_HH:mm:ss.SSS	0423_11:42:35.883
    // MM/dd/yyyy hh:mm:ss a:SSS	8/5/2011 3:31:18 AM:234
    #[test]
    fn test_detect_timeformat_in_string_and_match_regex() {
        derive_format_and_check!("2019-07-30 10:08:02.555", "YYYY-MM-DD hh:mm:ss.s");
        derive_format_and_check!("2019-07-30T10:08:02.555", "YYYY-MM-DDThh:mm:ss.s");
        derive_format_and_check!("2019-07-30 10:08:02.555 +0200", "YYYY-MM-DD hh:mm:ss.s TZD");
        derive_format_and_check!("2019-07-30T10:08:02.555 +0200", "YYYY-MM-DDThh:mm:ss.s TZD");
        derive_format_and_check!("2020 03 17 12:15:03 +01:00", "YYYY MM DD hh:mm:ss TZD");
        derive_format_and_check!(
            "2020 03 17 12:15:03.555 +01:00",
            "YYYY MM DD hh:mm:ss.s TZD"
        );
        derive_format_and_check!("2020 03 17 12:15:03.555", "YYYY MM DD hh:mm:ss.s");
        derive_format_and_check!("2020 03 17T12:15:03.555", "YYYY MM DDThh:mm:ss.s");
        derive_format_and_check!("2020 03 17T12:15:03", "YYYY MM DDThh:mm:ss");
        // 	04/23/17 04:34:22 +0000
        // MM/dd/yyyy HH:mm:ss ZZZZ 	10/03/2017 07:29:46 -0700

        derive_format_and_check!("04/23/17 04:34:22 +0000", "MM/DD/yy hh:mm:ss TZD");
        derive_format_and_check!("9/28/2011 2:23:15 PM", "MM/DD/YYYY hh:mm:ss a");
        derive_format_and_check!("9/28/2011 2:23:15 AM", "MM/DD/YYYY hh:mm:ss a");
        derive_format_and_check!("23 Apr 2017 11:42:35", "DD MMM YYYY hh:mm:ss");

        derive_format_and_check!("07-30 10:08:02.555", "MM-DD hh:mm:ss.s");
        derive_format_and_check!("07-30T10:08:02.555", "MM-DDThh:mm:ss.s");
        derive_format_and_check!("07-30 10:08:02.555 +0200", "MM-DD hh:mm:ss.s TZD");
        derive_format_and_check!("07-30T10:08:02.555 +0200", "MM-DDThh:mm:ss.s TZD");

        derive_format_and_check!("07-30-2019 10:08:02.555", "MM-DD-YYYY hh:mm:ss.s");
        derive_format_and_check!("07-30-2019T10:08:02.555", "MM-DD-YYYYThh:mm:ss.s");
        derive_format_and_check!("07-30-2019 10:08:02.555 +0200", "MM-DD-YYYY hh:mm:ss.s TZD");
        derive_format_and_check!("07-30-2019T10:08:02.555 +0200", "MM-DD-YYYYThh:mm:ss.s TZD");

        derive_format_and_check!("30-Jul-2019 10:08:02", "DD-MMM-YYYY hh:mm:ss");
        derive_format_and_check!("30/Jul/2019 10:08:02", "DD/MMM/YYYY hh:mm:ss");
        derive_format_and_check!("30/Jul/2019:10:08:02", "DD/MMM/YYYY:hh:mm:ss");
        derive_format_and_check!("30/Jul/2019:10:08:02 +0200", "DD/MMM/YYYY:hh:mm:ss TZD");
        derive_format_and_check!("30/Jul/2019T10:08:02", "DD/MMM/YYYYThh:mm:ss");
        derive_format_and_check!("30/Jul/2019T10:08:02 +0200", "DD/MMM/YYYYThh:mm:ss TZD");
        derive_format_and_check!("23/Jan/2019:23:58:13", "DD/MMM/YYYY:hh:mm:ss");
        derive_format_and_check!("1997-07-16T19:20:59 +01:00", "YYYY-MM-DDThh:mm:ss TZD");
        derive_format_and_check!("1997-07-16T19:20:30.45+01:00", "YYYY-MM-DDThh:mm:ss.s TZD");
        derive_format_and_check!(
            "2020-03-12T12:31:17.316631+01:00",
            "YYYY-MM-DDThh:mm:ss.s TZD"
        );
        derive_format_and_check!("2019-07-30T09:38:02.555Z", "YYYY-MM-DDThh:mm:ss.s");
    }

    #[test]
    fn test_detect_timeformat_only() {
        match_format!("22-05 12:36:36.506 +0100", "DD-MM hh:mm:ss.s TZD");
        match_format!("15-05-2019 12:36:04.344 A0", "DD-MM-YYYY hh:mm:ss.s");
        match_format!("23|05|2019", "DD|MM|YYYY");
        match_format!("1997  some other crap", "YYYY");
        match_format!("something before: [1997]", "YYYY");
        match_format!("1559831467577", "sss");
        match_format!("1997-07", "YYYY-MM");
        match_format!("1997-07-16", "YYYY-MM-DD");
        match_format!("1997071619203045+12:00", "YYYYMMDDhhmmsssTZD");
        no_match_format!("YYYY", "3000"); // invalid year
        no_match_format!("DD-MM hh:mm:ss.s TZD", "05-22 12:36:36.506 +0100"); // invalid month
        no_match_format!("YYYY-MM-DDThh:mm:ss.sTZD", "1997-07-36T19:20:30.45+01:00"); // "invalid day"
        no_match_format!("YYYY-MM-DDThh:mmTZD", "1997-07-16T24:20+01:00"); // invalid hours
        no_match_format!("YYYY-MM-DDThh:mmTZD", "1997-07-16T14:60+01:00"); // invalid minutes
        no_match_format!("YYYY-MM-DDThh:mm:ssTZD", "1997-07-16T19:20:60+01:00"); // invalid seconds
        no_match_format!("YYYYMMDDhhmmsssTZD", "1997071619203045+15:00"); // "invalid timezone"
        no_match_format!("YYYYMMDDhhmmsssTZD", "1997071619203045+10:02"); // "invalid timezone"
        no_match_format!("YYYYMMDDhhmmsssTZD", "12l 42 something different 3242");
        // "invalid timezone"
    }
    #[test]
    fn test_detect_timestamp_in_string_simple() {
        match detect_timestamp_in_string("2019-07-30 10:08:02.555", Some(0)) {
            Ok((timestamp, _, _)) => assert_eq!(
                NaiveDate::from_ymd_opt(2019, 7, 30)
                    .expect("incorrect format")
                    .and_hms_opt(10, 8, 2) // UTC
                    .expect("incorrect format")
                    .timestamp()
                    * 1000
                    + 555,
                timestamp
            ),
            Err(e) => panic!("error happened in detection: {e}"),
        }
        match detect_timestamp_in_string("2019-07-30 09:38:02.555 -00:30", None) {
            Ok((timestamp, _, _)) => assert_eq!(
                NaiveDate::from_ymd_opt(2019, 7, 30)
                    .expect("incorrect format")
                    .and_hms_opt(9, 38, 2) // UTC
                    .expect("incorrect format")
                    .timestamp()
                    * 1000
                    + 555
                    + THIRTY_MIN_IN_MS,
                timestamp
            ),
            Err(e) => panic!("error happened in detection: {e}"),
        }
    }
    #[test]
    fn test_detect_timestamp_with_timezone_indicated_but_missing() {
        match detect_timestamp_in_string("[2019-07-30T10:08:02.555][DEBUG][indexing]: xyz", Some(0))
        {
            Ok((timestamp, _, _)) => assert_eq!(
                NaiveDate::from_ymd_opt(2019, 7, 30)
                    .expect("incorrect format")
                    .and_hms_opt(10, 8, 2) // UTC
                    .expect("incorrect format")
                    .timestamp()
                    * 1000
                    + 555,
                timestamp
            ),
            Err(e) => panic!("error happened in detection: {e}"),
        }
    }

    #[test]
    fn test_detect_timestamp_in_string_with_t() {
        match detect_timestamp_in_string("2019-07-30T10:08:02.555", Some(0)) {
            Ok((timestamp, _, _)) => assert_eq!(
                NaiveDate::from_ymd_opt(2019, 7, 30)
                    .expect("incorrect format")
                    .and_hms_opt(10, 8, 2) // UTC
                    .expect("incorrect format")
                    .timestamp()
                    * 1000
                    + 555,
                timestamp
            ),
            Err(e) => panic!("error happened in detection: {e}"),
        }
        match detect_timestamp_in_string("2019-07-30T04:38:02.555 -05:30", None) {
            Ok((timestamp, _, _)) => assert_eq!(
                NaiveDate::from_ymd_opt(2019, 7, 30)
                    .expect("incorrect format")
                    .and_hms_opt(4, 38, 2) // UTC
                    .expect("incorrect format")
                    .timestamp()
                    * 1000
                    + 555
                    + FIVE_HOURS_THIRTY_MIN_IN_MS,
                timestamp
            ),
            Err(e) => panic!("error happened in detection: {e}"),
        }
        match detect_timestamp_in_string("2019-07-30T11:08:02.555+01:00", None) {
            Ok((timestamp, _, _)) => assert_eq!(
                NaiveDate::from_ymd_opt(2019, 7, 30)
                    .expect("incorrect format")
                    .and_hms_opt(10, 8, 2)
                    .expect("incorrect format")
                    .timestamp()
                    * 1000
                    + 555,
                timestamp
            ),
            Err(e) => panic!("error happened in detection: {e}"),
        }
    }
    #[test]
    fn test_detect_timestamp_in_string_no_year() {
        let year = Utc::now().date_naive().year();
        match detect_timestamp_in_string("07-30 10:08:02.555", Some(0)) {
            Ok((timestamp, _, _)) => assert_eq!(
                NaiveDate::from_ymd_opt(year, 7, 30)
                    .expect("incorrect format")
                    .and_hms_opt(10, 8, 2)
                    .expect("incorrect format")
                    .timestamp()
                    * 1000
                    + 555,
                timestamp
            ),
            Err(e) => panic!("error happened in detection: {e}"),
        }
        match detect_timestamp_in_string("07-30 12:08:02.555 +0200", None) {
            Ok((timestamp, _, _)) => assert_eq!(
                NaiveDate::from_ymd_opt(year, 7, 30)
                    .expect("incorrect format")
                    .and_hms_opt(10, 8, 2)
                    .expect("incorrect format")
                    .timestamp()
                    * 1000
                    + 555,
                timestamp
            ),
            Err(e) => panic!("error happened in detection: {e}"),
        }
    }

    #[test]
    fn test_detect_timestamp_in_string_no_year_with_t() {
        let year = Utc::now().date_naive().year();
        match detect_timestamp_in_string("07-30T10:08:02.555", Some(0)) {
            Ok((timestamp, _, _)) => assert_eq!(
                NaiveDate::from_ymd_opt(year, 7, 30)
                    .expect("incorrect format")
                    .and_hms_opt(10, 8, 2)
                    .expect("incorrect format")
                    .timestamp()
                    * 1000
                    + 555,
                timestamp
            ),
            Err(e) => panic!("error happened in detection: {e}"),
        }
        match detect_timestamp_in_string("07-30T15:08:02.555 +05:00", None) {
            Ok((timestamp, _, _)) => assert_eq!(
                NaiveDate::from_ymd_opt(year, 7, 30)
                    .expect("incorrect format")
                    .and_hms_opt(10, 8, 2)
                    .expect("incorrect format")
                    .timestamp()
                    * 1000
                    + 555,
                timestamp
            ),
            Err(e) => panic!("error happened in detection: {e}"),
        }
    }
    #[test]
    fn test_detect_timestamp_in_string_year_last() {
        match detect_timestamp_in_string("07-30-2019 10:08:02.555", Some(0)) {
            Ok((timestamp, _, _)) => assert_eq!(
                NaiveDate::from_ymd_opt(2019, 7, 30)
                    .expect("incorrect format")
                    .and_hms_opt(10, 8, 2)
                    .expect("incorrect format")
                    .timestamp()
                    * 1000
                    + 555,
                timestamp
            ),
            Err(e) => panic!("error happened in detection: {e}"),
        }
        match detect_timestamp_in_string("07-30-2019 08:08:02.555 -0200", None) {
            Ok((timestamp, _, _)) => assert_eq!(1_564_481_282_555, timestamp),
            Err(e) => panic!("error happened in detection: {e}"),
        }
    }
    #[test]
    fn test_detect_timestamp_in_string_short_month_name() {
        match detect_timestamp_in_string("109.169.248.247 - - [30/Jul/2019:10:08:02] xyz", Some(0))
        {
            Ok((timestamp, _, _)) => assert_eq!(
                NaiveDate::from_ymd_opt(2019, 7, 30)
                    .expect("incorrect format")
                    .and_hms_opt(10, 8, 2)
                    .expect("incorrect format")
                    .timestamp()
                    * 1000,
                timestamp
            ),
            Err(e) => panic!("error happened in detection: {e}"),
        }
        match detect_timestamp_in_string(
            "109.169.248.247 - - [30/Jul/2019:12:08:02 +0200] xyz",
            None,
        ) {
            Ok((timestamp, _, _)) => assert_eq!(
                NaiveDate::from_ymd_opt(2019, 7, 30)
                    .expect("incorrect format")
                    .and_hms_opt(12, 8, 2)
                    .expect("incorrect format")
                    .timestamp()
                    * 1000
                    - TWO_HOURS_IN_MS,
                timestamp
            ),
            Err(e) => panic!("error happened in detection: {e}"),
        }
    }

    test_generator::test_expand_paths! { test_detect_regex; "processor/test_samples/detecting/*" }

    fn test_detect_regex(dir_name: &str) {
        let in_path = PathBuf::from("..").join(dir_name).join("in.log");
        let res = detect_timestamp_format_in_file(&in_path).expect("could not detect regex type");

        let mut format_path = PathBuf::from("..").join(dir_name);
        format_path.push("expected.format");
        let contents =
            fs::read_to_string(format_path).expect("Something went wrong reading the file");
        let expected_format_string: String = contents.trim().to_string();
        assert_eq!(expected_format_string, res);
    }

    #[test]
    fn test_timespan_in_file() {
        init();
        use std::{fs::File, io::Write};
        use tempfile::tempdir;
        let dir = tempdir().expect("problem creating temp dir");
        let file_path = dir.path().join("my-temp-log.txt");
        let mut f = File::create(&file_path).expect("");

        let ts_min = 1_584_447_316;
        let ts_mid = 1_584_447_318;
        let ts_max = 1_584_447_320;

        writeln!(
            f,
            "{} abc",
            unix_timestamp_to_utc(ts_min).expect("valid").to_rfc3339()
        )
        .expect("tempfile");
        writeln!(
            f,
            "{} def",
            unix_timestamp_to_utc(ts_mid).expect("valid").to_rfc3339()
        )
        .expect("tempfile");
        writeln!(
            f,
            "{} ghi",
            unix_timestamp_to_utc(ts_max).expect("valid").to_rfc3339()
        )
        .expect("tempfile");
        match timespan_in_file("YYYY-MM-DDThh:mm:ssTZD", &file_path, None) {
            Ok(res) => {
                assert_eq!(res.max_time, Some(ts_max * 1000));
                assert_eq!(res.min_time, Some(ts_min * 1000));
            }
            Err(e) => panic!("error was: {e}"),
        }
        // test a format expression that does not match
        match timespan_in_file("YYYY MM DD hh:mm TZD", &file_path, None) {
            Ok(res) => {
                if res.format.is_ok() {
                    panic!("format string should not match but was: {res:?}")
                }
            }
            Err(e) => panic!("error was: {e}"),
        }
    }

    #[test]
    fn test_check_format() {
        init();
        fn format_was_ok(res: FormatCheckResult) -> bool {
            matches!(res, FormatCheckResult::FormatRegex(_))
        }
        const FLAGS: FormatCheckFlags = FormatCheckFlags {
            miss_day: false,
            miss_year: false,
            miss_month: false,
        };
        const FLAGS_MISS_YEAR: FormatCheckFlags = FormatCheckFlags {
            miss_day: false,
            miss_year: true,
            miss_month: false,
        };
        assert!(format_was_ok(check_format(
            "YYYY-MM-DDThh:mm:ssTZD",
            FLAGS.clone()
        )));
        assert!(format_was_ok(check_format(
            "YYYY-MM-DDThh:mm:ss",
            FLAGS.clone()
        ))); // OK without timezone
        assert!(!format_was_ok(check_format(
            "MM-DDThh:mm:ss",
            FLAGS.clone()
        ))); // no year - false
        assert!(format_was_ok(check_format(
            "MM-DDThh:mm:ss",
            FLAGS_MISS_YEAR.clone()
        ))); // no year - true
        assert!(!format_was_ok(check_format(
            "YYYY-DDThh:mm:ss",
            FLAGS.clone()
        ))); // no month
        assert!(format_was_ok(check_format(
            "YYYY-DD(MMM)Thh:mm:ss",
            FLAGS.clone()
        ))); // short month
        assert!(!format_was_ok(check_format(
            "YYYY-MMThh:mm:ss",
            FLAGS.clone()
        ))); // no days
        assert!(!format_was_ok(check_format(
            "YYYY-DD-MMTmm:ss",
            FLAGS.clone()
        ))); // no hours
        assert!(!format_was_ok(check_format(
            "YYYY-DD-MMThh:ss",
            FLAGS.clone()
        ))); // no minutes
        assert!(format_was_ok(check_format(
            "YYYY-DD-MMThh:mm",
            FLAGS.clone()
        ))); // no seconds should be ok
    }

    #[test]
    fn test_scan_lines() {
        init();
        use std::{fs::File, io::Write};
        use tempfile::tempdir;
        let dir = tempdir().expect("problem creating temp dir");
        let file_path = dir.path().join("my-temp-log.txt");
        let mut f = File::create(&file_path).expect("");

        let ts_min: i64 = 1_584_447_316;
        let mut ts_max = ts_min;
        let line_cnt = 1000usize;
        for i in 0..line_cnt {
            ts_max = ts_min + (i as i64);
            writeln!(
                f,
                "{} {}",
                unix_timestamp_to_utc(ts_max).expect("valid").to_rfc3339(),
                i
            )
            .expect("tempfile");
        }
        let regex = lookup_regex_for_format_str("YYYY-MM-DDThh:mm:ssTZD").expect("regex failed");
        let f2 = File::open(&file_path).expect("");
        let (scanned, min, max) = scan_lines(&f2, &regex, None, None, None).expect("scan failed");
        assert_eq!(min, Some(ts_min * 1000));
        assert_eq!(max, Some(ts_max * 1000));
        assert_eq!(scanned, line_cnt);
    }
}
