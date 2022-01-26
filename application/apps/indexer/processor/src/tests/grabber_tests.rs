#[cfg(test)]
mod tests {
    extern crate rand;
    use crate::{
        grabber::{
            identify_byte_range, identify_end_slot_simple, identify_start_slot,
            identify_start_slot_simple, ByteRange, FilePart, GrabError, GrabMetadata, Grabber,
            LineRange, Slot,
        },
        text_source::TextFileSource,
    };
    use pretty_assertions::assert_eq;
    use proptest::prelude::*;
    use std::ops::RangeInclusive;

    fn write_content_to_tmp_file(content: &[String]) -> tempfile::TempPath {
        use std::io::{BufWriter, Write};
        use tempfile::NamedTempFile;
        let file = NamedTempFile::new().expect("Could not create tmp file");
        let mut line_length: Vec<u64> = vec![];
        let mut writer = BufWriter::new(file);
        for (i, line) in content.iter().enumerate() {
            if i == content.len() - 1 && !line.is_empty() {
                // last
                write!(writer, "{}", line).expect("Could not write");
            } else {
                writeln!(writer, "{}", line).expect("Could not write");
            }

            line_length.push(line.len() as u64);
        }
        let ff = writer.into_inner().expect("could not get at file anymore");
        ff.into_temp_path()
    }

    fn is_consistent(content: &[String], metadata: &GrabMetadata) -> bool {
        println!(
            "slots: {:?}, line_count: {}, content-len: {}",
            metadata.slots,
            metadata.line_count,
            content.len()
        );
        true
    }

    static LINE_REGEX: &str = r"[a-z]{0,200}";
    proptest! {
        #[test]
        fn produced_metadata_is_consistent(v in prop::collection::vec(LINE_REGEX, 0..500)) {
            let p = write_content_to_tmp_file(&v);
            let source = TextFileSource::new(&p, "sourceA");
            if let Ok(grabber) = Grabber::new(source) {
                let metadata = grabber.metadata.expect("metadata was not created");
                assert!(is_consistent(&v, &metadata));
            }

        }
    }

    fn identify_range_simple(slots: &[Slot], line_index: u64) -> Option<(Slot, usize)> {
        for (i, slot) in slots.iter().enumerate() {
            if slot.lines.range.contains(&line_index) {
                // println!(
                //     "found start of line index {} in {:?} (slot[{}])",
                //     line_index, slot, i
                // );
                return Some((slot.clone(), i));
            }
        }
        None
    }

    #[test]
    fn test_identify_range_a() {
        fn create(br: RangeInclusive<u64>, lr: RangeInclusive<u64>) -> Slot {
            Slot {
                bytes: ByteRange::from(br),
                lines: LineRange::from(lr),
            }
        }
        let slots = vec![
            create(0..=3, 0..=1),
            create(4..=7, 1..=2),
            create(8..=11, 2..=3),
            create(12..=15, 4..=5),
        ];
        // idx +----+----+----+
        //  00 |   0|  1 |  2 |  slots[0] (0..=3, 0..=1)
        //  01 |   3|| 4 |  5 |  slots[1] (4..=7, 1..=2)
        //  02 |   6|  7 || 8 |  slots[2] (8..=11, 2..=3)
        //  03 |   9| 10 | 11||
        //  04 |  12| 13 | 14 |  slots[3] (12..=15, 4..=5)
        //  05 |  15||16 | 17 |
        let slot = |i: usize| -> Option<(Slot, usize)> { Some((slots[i].clone(), i)) };
        let identify_start = |i| -> Option<(Slot, usize)> { identify_start_slot_simple(&slots, i) };
        let identify_end = |i| -> Option<(Slot, usize)> { identify_end_slot_simple(&slots, i) };

        // line 0
        assert_eq!(identify_start(0), slot(0));
        assert_eq!(identify_end(0), slot(0));
        // line 1
        assert_eq!(identify_start(1), slot(0));
        assert_eq!(identify_end(1), slot(1));
        // line 2
        assert_eq!(identify_start(2), slot(1));
        assert_eq!(identify_end(2), slot(2));
        // line 3
        assert_eq!(identify_start(3), slot(2));
        assert_eq!(identify_end(3), slot(2));
        // line 4
        assert_eq!(identify_start(4), slot(3));
        assert_eq!(identify_end(4), slot(3));
        // line 5
        assert_eq!(identify_start(5), slot(3));
        assert_eq!(identify_end(5), slot(3));

        assert_eq!(
            identify_byte_range(&slots, &LineRange::single_line(0)),
            Some(FilePart {
                offset_in_file: 0,
                length: 4,
                total_lines: 2,
                lines_to_skip: 0,
                lines_to_drop: 1,
            })
        );
        assert_eq!(
            identify_byte_range(&slots, &LineRange::from(1..=2)),
            Some(FilePart {
                offset_in_file: 0,
                length: 12,
                total_lines: 4,
                lines_to_skip: 1,
                lines_to_drop: 1,
            })
        );
    }

    #[test]
    fn test_identify_range() -> Result<(), GrabError> {
        use std::io::Write;
        use tempfile::NamedTempFile;
        // many lines
        {
            let mut file = NamedTempFile::new().expect("could not create tmp file");
            let mut s = String::new();
            for i in 0..80 {
                s.push_str(&format!("{}", i % 10));
            }
            for _line in 0..1000 {
                writeln!(file, "{}", s).expect("could not write to file");
            }
            let p = file.into_temp_path();
            let source = TextFileSource::new(&p, "sourceA");
            let line_count = source.count_lines()? as u64;
            let grabber = Grabber::new(source)?;

            if let Some(metadata) = &grabber.metadata {
                for line_index in 0..line_count {
                    assert_eq!(
                        identify_range_simple(&metadata.slots, line_index),
                        identify_start_slot(&metadata.slots, line_index)
                    );
                }
            }
        }
        Ok(())
    }

    #[test]
    fn test_identify_range_long_lines() -> Result<(), GrabError> {
        use std::io::Write;
        use tempfile::NamedTempFile;
        // long lines
        {
            let mut file = NamedTempFile::new().expect("could not create tmp file");
            let mut s = String::new();
            for i in 0..10000 {
                s.push_str(&format!("{}", i % 10));
            }
            for _line in 0..100 {
                writeln!(file, "{}", s).expect("could not write to file");
            }
            let p = file.into_temp_path();
            let source = TextFileSource::new(&p, "sourceA");
            let line_count = source.count_lines()? as u64;
            // println!("----------> file has {} lines", line_count);
            let grabber = Grabber::new(source)?;
            let slots = grabber.metadata.unwrap().slots;
            for line_index in 0..line_count {
                assert_eq!(
                    identify_range_simple(&slots, line_index),
                    identify_start_slot(&slots, line_index)
                );
            }
        }
        Ok(())
    }

    #[test]
    fn test_get_entries_single_one_char_line() -> Result<(), GrabError> {
        use std::io::Write;
        use tempfile::NamedTempFile;
        let mut file = NamedTempFile::new().expect("could not create tmp file");
        write!(file, "a").expect("could not write to file");
        let p = file.into_temp_path();
        let source = TextFileSource::new(&p, "sourceA");
        let grabber = Grabber::new(source)?;
        let single_line_range = LineRange::single_line(0);
        let naive = grabber
            .get_entries(&single_line_range)?
            .grabbed_elements
            .into_iter()
            .map(|e| e.content)
            .collect::<Vec<String>>();
        let expected: Vec<String> = vec!["a".to_owned()];
        assert_eq!(naive, expected);
        Ok(())
    }

    fn check_sample_entries(str_entries: Vec<&str>) -> Result<(), GrabError> {
        let entries: Vec<String> = str_entries.iter().map(|s| s.to_string()).collect();
        let entries_len = entries.len();
        let p = write_content_to_tmp_file(&entries);
        let source = TextFileSource::new(&p, "sourceA");
        if let Ok(grabber) = Grabber::new(source) {
            let r = LineRange::from(0..=((entries_len - 1) as u64));
            let naive = grabber
                .get_entries(&r)
                .expect("entries not grabbed")
                .grabbed_elements
                .into_iter()
                .map(|e| e.content)
                .collect::<Vec<String>>();
            assert_eq!(naive, entries);
        }
        Ok(())
    }
    #[test]
    fn test_grab_all_entries_in_file_with_empty_lines() -> Result<(), GrabError> {
        check_sample_entries(vec!["A", ""])?;
        check_sample_entries(vec!["a", "", ""])
    }

    #[test]
    fn test_grab_all_entries_in_file_with_some_empty_lines() -> Result<(), GrabError> {
        check_sample_entries(vec!["", "", "a"])?;
        check_sample_entries(vec!["a", "", "a"])?;
        check_sample_entries(vec!["", "a", "", "a"])?;
        check_sample_entries(vec!["a", "", "", "a"])?;
        check_sample_entries(vec!["", "a"])
    }

    // #[test]
    // fn test_get_entries_empty_line_at_end() -> Result<()> {
    //     use std::io::Write;
    //     use tempfile::NamedTempFile;
    //     let mut file = NamedTempFile::new()?;
    //     write!(file, "ABC")?;
    //     writeln!(file)?;
    //     let p = file.into_temp_path();
    //     let grabber = Grabber::new(&p, "sourceA")?;
    //     println!("grabber metadata: {:?}", grabber.metadata);
    //     let one_line_empty_range = LineRange::single_line(1);
    //     let naive = grabber.get_entries(&one_line_empty_range)?;
    //     let expected: Vec<String> = vec!["".to_owned()];
    //     println!("naive: {:?}", naive);
    //     println!("expected: {:?}", expected);
    //     assert_eq!(
    //         naive
    //             .grabbed_elements
    //             .into_iter()
    //             .map(|e| e.content)
    //             .collect::<Vec<String>>(),
    //         expected
    //     );
    //     Ok(())
    // }

    #[test]
    fn test_get_one_line_only() -> Result<(), GrabError> {
        use std::io::Write;
        use tempfile::NamedTempFile;
        let mut file = NamedTempFile::new().expect("could not create tmp file");
        write!(file, "ABC").expect("could not write to file");
        let p = file.into_temp_path();
        let source = TextFileSource::new(&p, "sourceA");
        let grabber = Grabber::new(source)?;
        let one_line_range = LineRange::single_line(0);
        let c1 = grabber
            .get_entries(&one_line_range)?
            .grabbed_elements
            .into_iter()
            .map(|e| e.content)
            .collect::<Vec<String>>();
        let c2: Vec<String> = vec!["ABC".to_owned()];
        assert_eq!(c1, c2);
        Ok(())
    }

    #[test]
    fn test_get_lines_problem() -> Result<(), GrabError> {
        use std::io::Write;
        use tempfile::NamedTempFile;
        let mut file = NamedTempFile::new().expect("could not create tmp file");
        writeln!(file, " 1 testblah").expect("could not write to file");
        writeln!(file, " 2 testblah").expect("could not write to file");
        writeln!(file, " 3 testblah").expect("could not write to file");
        writeln!(file, " 4 testblah").expect("could not write to file");
        writeln!(file, " 5 testblah").expect("could not write to file");
        writeln!(file, " 6 testblah").expect("could not write to file");
        writeln!(file, " 7 testblah").expect("could not write to file");
        writeln!(file, " 8 testblah").expect("could not write to file");
        writeln!(file, " 9 testblah").expect("could not write to file");
        write!(file, "10 testblah").expect("could not write to file");
        let p = file.into_temp_path();
        let source = TextFileSource::new(&p, "sourceA");
        let grabber = Grabber::new(source)?;

        fn grabbed_lines(grabber: &Grabber, r: &LineRange) -> Vec<String> {
            grabber
                .get_entries(r)
                .expect("Could not get entries")
                .grabbed_elements
                .into_iter()
                .map(|e| e.content)
                .collect()
        }

        for i in 0..9 {
            assert_eq!(
                grabbed_lines(&grabber, &LineRange::single_line(i)),
                vec![format!("{0:>2} testblah", i + 1)]
            );
        }
        // assert!(false);
        Ok(())
    }

    #[test]
    fn test_get_entries_only_empty_lines() -> Result<(), GrabError> {
        use std::io::Write;
        use tempfile::NamedTempFile;
        let mut file = NamedTempFile::new().expect("could not create tmp file");
        // 3 lines, all empty
        writeln!(file).expect("could not write to file");
        writeln!(file).expect("could not write to file");
        let p = file.into_temp_path();

        let source = TextFileSource::new(&p, "sourceA");
        let grabber = Grabber::new(source)?;
        let one_line_range = LineRange::single_line(0);
        let c1 = grabber
            .get_entries(&one_line_range)?
            .grabbed_elements
            .into_iter()
            .map(|e| e.content)
            .collect::<Vec<String>>();
        let c2: Vec<String> = vec!["".to_owned()];
        assert_eq!(c1, c2);
        Ok(())
    }
}
