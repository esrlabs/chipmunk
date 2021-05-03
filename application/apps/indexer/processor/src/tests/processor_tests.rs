#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    extern crate rand;
    // extern crate tempdir;
    use crate::grabber::identify_byte_range;
    use crate::grabber::identify_end_slot_simple;
    use crate::grabber::identify_start_slot;
    use crate::grabber::identify_start_slot_simple;
    use crate::grabber::FilePart;
    use crate::grabber::GrabError;
    use crate::{
        grabber::{ByteRange, Grabber, LineRange, Slot},
        processor::*,
    };
    use anyhow::Result;
    use crossbeam_channel as cc;
    use crossbeam_channel::unbounded;
    use indexer_base::{
        chunks::{Chunk, ChunkResults},
        config::IndexingConfig,
        progress::{IndexingProgress, Notification},
    };
    use pretty_assertions::assert_eq;
    use std::ops::RangeInclusive;
    use std::{fs, path::PathBuf};
    use tempfile::tempdir;

    async fn get_chunks(
        test_content: &str,
        chunksize: usize,
        tag_name: &str,
        tmp_file_name: Option<&str>,
    ) -> (Vec<Chunk>, String) {
        let tmp_dir = tempdir().expect("could not create temp dir");
        let test_file_path = tmp_dir.path().join("tmpTestFile.txt");
        let out_file_path = tmp_dir.path().join("tmpTestFile.txt.out");
        fs::write(&test_file_path, test_content).expect("testfile could not be written");
        let source_file_size = fs::metadata(&test_file_path)
            .expect("metadata not found")
            .len();

        // call our function
        let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
        create_index_and_mapping(
            IndexingConfig {
                tag: tag_name.to_owned(),
                chunk_size: chunksize,
                in_file: test_file_path,
                out_path: out_file_path.clone(),
                append: tmp_file_name.is_some(),
                watch: false,
            },
            source_file_size,
            false,
            tx,
            None,
        )
        .await
        .unwrap();
        let out_file_content: String =
            fs::read_to_string(&out_file_path).expect("could not read file");

        // cleanup
        let _ = tmp_dir.close();
        // consume all results from queue
        let mut chunks: Vec<Chunk> = vec![];
        loop {
            match rx.recv() {
                Ok(Ok(IndexingProgress::Finished)) => {
                    trace!("finished...");
                    return (chunks, out_file_content);
                }
                Ok(Err(Notification {
                    severity,
                    content,
                    line,
                })) => {
                    trace!(
                        "[{:?}]: getChunks: received notification[{:?}]...{}",
                        line,
                        severity,
                        content,
                    );
                }
                Ok(Ok(IndexingProgress::Progress { ticks: _t })) => {
                    trace!("progress...");
                }
                Ok(Ok(IndexingProgress::GotItem { item: chunk })) => {
                    chunks.push(chunk);
                    trace!("got item...");
                }
                Ok(Ok(IndexingProgress::Stopped)) => {
                    trace!("stopped...");
                }
                Err(_) => {
                    error!("couldn't process");
                }
            }
        }
    }
    type Pair = (usize, usize);

    fn chunks_fit_together(chunks: &[Chunk]) -> bool {
        if chunks.is_empty() {
            return true;
        }
        let byte_ranges: Vec<(usize, usize)> = chunks.iter().map(|x| x.b).collect();
        let bytes_tail: &[(usize, usize)] = &byte_ranges[1..];
        let bytes_pairs: Vec<(&Pair, &Pair)> = byte_ranges.iter().zip(bytes_tail.iter()).collect();
        let row_ranges: Vec<(usize, usize)> = chunks.iter().map(|x| x.r).collect();
        let row_tail: &[(usize, usize)] = &row_ranges[1..];
        let row_pairs: Vec<(&Pair, &Pair)> = row_ranges.iter().zip(row_tail.iter()).collect();
        bytes_pairs.iter().all(|&(p1, p2)| p1.1 + 1 == p2.0)
            && row_pairs.iter().all(|&(p1, p2)| p1.1 + 1 == p2.0)
    }

    #[tokio::test]
    async fn test_append_to_empty_output() -> Result<()> {
        let tmp_dir = tempdir().expect("could not create temp dir");
        let empty_file_path = tmp_dir.path().join("empty.log");
        // call our function
        fs::write(&empty_file_path, "").expect("testfile could not be written");
        let out_path = tmp_dir.path().join("test_append_to_empty_output.log.out");
        let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();

        let source_file_size = fs::metadata(&empty_file_path)
            .expect("metadata not found")
            .len();
        create_index_and_mapping(
            IndexingConfig {
                tag: "tag".to_owned(),
                chunk_size: 1,
                in_file: empty_file_path,
                out_path: out_path.clone(),
                append: false,
                watch: false,
            },
            source_file_size,
            false,
            tx,
            None,
        )
        .await?;

        let mut chunks: Vec<Chunk> = vec![];
        loop {
            match rx.recv() {
                Ok(Ok(IndexingProgress::Finished)) => {
                    println!("finished...");
                    assert_eq!(0, chunks.len(), "empty file should produce 0 chunks");
                    break;
                }
                Ok(Ok(IndexingProgress::Progress { ticks: _t })) => {
                    println!("progress...");
                }
                Ok(Err(Notification {
                    severity,
                    content,
                    line,
                })) => {
                    println!(
                        "[{:?}]: test_append_to_empty_output: notification[{:?}]...{}",
                        line, severity, content
                    );
                }
                Ok(Ok(IndexingProgress::GotItem { item: chunk })) => {
                    println!("got item...{:?}", &chunk);
                    chunks.push(chunk);
                }
                Ok(Ok(IndexingProgress::Stopped)) => {
                    println!("stopped...");
                }
                Err(_) => {
                    println!("couldn't process");
                }
            }
        }
        let out_file_content: String = fs::read_to_string(&out_path).expect("could not read file");
        assert_eq!(
            0,
            out_file_content.len(),
            "empty file should produce empty output"
        );
        // same with non empty file
        println!("second time call to create_index_and_mapping ==================");
        let nonempty_file_path = tmp_dir.path().join("not_empty.log");
        fs::write(&nonempty_file_path, "A").unwrap();
        let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();

        let source_file_size = fs::metadata(&nonempty_file_path)
            .expect("metadata not found")
            .len();
        create_index_and_mapping(
            IndexingConfig {
                tag: "tag".to_owned(),
                chunk_size: 1,
                in_file: nonempty_file_path,
                out_path: out_path.clone(),
                append: true,
                watch: true,
            },
            source_file_size,
            false,
            tx,
            None,
        )
        .await?;
        let mut chunks: Vec<Chunk> = vec![];
        loop {
            match rx.recv() {
                Ok(Ok(IndexingProgress::Finished)) => {
                    println!("finished...");
                    let out_file_content: String =
                        fs::read_to_string(out_path).expect("could not read file");
                    println!("outfile: {}\nchunks: {:?}", out_file_content, chunks);
                    assert_eq!(
                        1,
                        chunks.len(),
                        "nonempty file should produce nonempty output"
                    );
                    assert_eq!(0, chunks[0].r.0, "first chunk row should start with 0");
                    break;
                }
                Ok(Ok(IndexingProgress::Progress { ticks: _t })) => {
                    println!("progress...");
                }
                Ok(Err(Notification {
                    severity,
                    content,
                    line,
                })) => {
                    println!(
                        "[{:?}]: test_append_to_empty_output2: notification[{:?}]...{}",
                        line, severity, content
                    );
                }
                Ok(Ok(IndexingProgress::GotItem { item: chunk })) => {
                    println!("got item...{:?}", chunk);
                    chunks.push(chunk);
                }
                Ok(Ok(IndexingProgress::Stopped)) => {
                    println!("stopped...");
                }
                Err(_) => {
                    println!("couldn't process");
                }
            }
        }
        Ok(())
    }
    #[tokio::test]
    async fn test_chunking_one_chunk_exact() {
        let (chunks, content) = get_chunks("A\n", 1, "some_new_tag", None).await;
        println!("chunks: {:?}", chunks);
        println!("content: {:02X?}", content.as_bytes());
        assert_eq!(1, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[tokio::test]
    async fn test_chunking_one_chunk_to_big() {
        let (chunks, content) = get_chunks("A\n", 2, "tag_ok", None).await;
        println!("chunks: {:?}", chunks);
        println!("content: {:02X?}", content.as_bytes());
        assert_eq!(1, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[tokio::test]
    async fn test_chunking_one_chunk_exact_no_nl() {
        let (chunks, content) = get_chunks("A", 1, "tag_no_nl", None).await;
        assert_eq!(1, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[tokio::test]
    async fn test_chunking_multiple_chunks_partly() {
        let (chunks, content) = get_chunks("A\nB\nC", 2, "T", None).await;
        println!("chunks: {:?}", chunks);
        println!(
            "content ({} bytes): {:02X?}",
            content.as_bytes().len(),
            content.as_bytes()
        );
        assert_eq!(2, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[tokio::test]
    async fn test_chunking_multiple_chunks_complete() {
        let (chunks, content) = get_chunks("A\nB\nC\nD\n", 2, "tag_chunk_complet", None).await;
        assert_eq!(2, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[tokio::test]
    async fn test_chunking_multiple_chunks_complete_no_nl() {
        let (chunks, content) = get_chunks("A\nB\nC\nD", 2, "tag_complete_no_nl", None).await;
        println!("chunks: {:?}", chunks);
        trace!("content: {:02X?}", content.as_bytes());
        assert_eq!(2, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    fn size_of_all_chunks(chunks: &[Chunk]) -> usize {
        let res = chunks
            .iter()
            .fold(0, |acc, x: &Chunk| acc + (x.b.1 - x.b.0));
        if chunks.len() > 1 {
            res + 1
        } else {
            res
        }
    }

    test_generator::test_expand_paths! { test_input_output; "processor/test_samples/indexing/*" }

    fn test_input_output(dir_name: &str) {
        let in_path = PathBuf::from("..").join(&dir_name).join("in.txt");
        let tmp_dir = tempdir().expect("could not create temp dir");
        let out_file_path = tmp_dir.path().join("tmpTestFile.txt.out");
        let restored_file_path = tmp_dir.path().join("restoredTestFile.txt.out");

        // ===> use this to create a file that contains the actual bytes in ~
        // use std::time::{SystemTime, UNIX_EPOCH};
        // let home_dir = dirs::home_dir().expect("couldn't get home directory");
        // let now = SystemTime::now();
        // let since_the_epoch = now.duration_since(UNIX_EPOCH).unwrap();
        // let last_in_ms = since_the_epoch.as_micros() as i64;
        // let out_file_path = home_dir.join(format!("{}_sample_test.test.out", last_in_ms));

        let append_to_this = PathBuf::from("..").join(&dir_name).join("append_here.log");
        let append_use_case = append_to_this.exists();

        if append_use_case {
            println!("append_use_case");
            fs::copy(&append_to_this, &out_file_path).expect("copy content failed");
        }
        let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
        use tokio::runtime::Runtime;
        // Create the runtime
        let rt = Runtime::new().expect("Could not create runtime");
        rt.block_on(async {
            create_index_and_mapping(
                IndexingConfig {
                    tag: "TAG".to_owned(),
                    chunk_size: 1,
                    in_file: in_path.clone(),
                    out_path: out_file_path.clone(),
                    append: append_use_case,
                    watch: false,
                },
                fs::metadata(&in_path).expect("metadata not found").len(),
                false,
                tx,
                None,
            )
            .await
            .unwrap();
        });
        let mut chunks: Vec<Chunk> = vec![];
        loop {
            match rx.recv() {
                Ok(Ok(IndexingProgress::Finished { .. })) => {
                    trace!("finished...");
                    let out_file_content_bytes =
                        fs::read(&out_file_path).expect("could not read file");
                    let out_file_content = String::from_utf8_lossy(&out_file_content_bytes[..]);
                    let expected_path = PathBuf::from("..").join(&dir_name).join("expected.output");
                    let expected_content_bytes =
                        fs::read(expected_path).expect("could not read expected file");
                    let expected_content = String::from_utf8_lossy(&expected_content_bytes[..]);
                    trace!(
                        "comparing\n{}\nto expected:\n{}",
                        out_file_content,
                        expected_content
                    );
                    assert_eq!(expected_content.trim_end(), out_file_content.trim_end());
                    assert_eq!(true, chunks_fit_together(&chunks), "chunks need to fit");
                    break;
                }
                Ok(Ok(IndexingProgress::Progress { ticks: _t })) => {
                    trace!("progress...");
                }
                Ok(Ok(IndexingProgress::GotItem { item: chunk })) => {
                    chunks.push(chunk);
                    trace!("got item...");
                }

                Ok(Err(Notification {
                    severity,
                    content,
                    line,
                })) => {
                    println!(
                        "[{:?}]: test_input_output: notification[{:?}]...{}",
                        line, severity, content
                    );
                }
                Ok(Ok(IndexingProgress::Stopped)) => {
                    trace!("stopped...");
                }
                Err(_) => {
                    error!("couldn't process");
                }
            }
        }
        if !append_use_case {
            if let Ok(()) = restore_original_from_indexed_file(&out_file_path, &restored_file_path)
            {
                let restored_file_content_bytes =
                    fs::read(restored_file_path).expect("could not read file");
                let restored_string = String::from_utf8_lossy(&restored_file_content_bytes[..]);
                let restored_file_content_lines: Vec<&str> = restored_string.lines().collect();

                let original_content_bytes =
                    fs::read(in_path).expect("could not read expected file");
                let original_string = String::from_utf8_lossy(&original_content_bytes[..]);
                let original_content_lines: Vec<&str> = original_string.lines().collect();
                trace!(
                    "comparing\n{:?}\nto expected:\n{:?}",
                    restored_file_content_lines,
                    original_content_lines
                );
                assert_eq!(original_content_lines, restored_file_content_lines);
            }
        }
    }

    fn identify_range_simple(slots: &[Slot], line_index: u64) -> Option<(Slot, usize)> {
        for (i, slot) in slots.iter().enumerate() {
            if slot.lines.range.contains(&line_index) {
                println!(
                    "found start of line index {} in {:?} (slot[{}])",
                    line_index, slot, i
                );
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
    fn test_identify_range() -> Result<()> {
        use std::io::Write;
        use tempfile::NamedTempFile;
        // many lines
        {
            let mut file = NamedTempFile::new()?;
            let mut s = String::new();
            for i in 0..80 {
                s.push_str(&format!("{}", i % 10));
            }
            for _line in 0..1000 {
                writeln!(file, "{}", s)?;
            }
            let p = file.into_temp_path();
            let line_count = Grabber::count_lines(&p)? as u64;
            let grabber = Grabber::new(&p, "sourceA")?;

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
    fn test_identify_range_long_lines() -> Result<()> {
        use std::io::Write;
        use tempfile::NamedTempFile;
        // long lines
        {
            let mut file = NamedTempFile::new()?;
            let mut s = String::new();
            for i in 0..10000 {
                s.push_str(&format!("{}", i % 10));
            }
            for _line in 0..100 {
                writeln!(file, "{}", s)?;
            }
            let p = file.into_temp_path();
            let line_count = Grabber::count_lines(&p)? as u64;
            println!("----------> file has {} lines", line_count);
            let grabber = Grabber::new(&p, "sourceA")?;
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
    fn test_get_entries_single_one_char_line() -> Result<()> {
        use std::io::Write;
        use tempfile::NamedTempFile;
        let mut file = NamedTempFile::new()?;
        write!(file, "a")?;
        let p = file.into_temp_path();
        let grabber = Grabber::new(&p, "sourceA")?;
        let single_line_range = LineRange::single_line(0);
        let naive = grabber
            .get_entries(&single_line_range)?
            .grabbed_elements
            .into_iter()
            .map(|e| e.content)
            .collect::<Vec<String>>();
        let entries: Vec<String> = vec!["a".to_owned()];
        assert_eq!(naive, entries);
        Ok(())
    }

    fn check_sample_entries(str_entries: Vec<&str>) -> Result<()> {
        use std::io::Write;
        use tempfile::NamedTempFile;
        let entries: Vec<String> = str_entries.iter().map(|s| s.to_string()).collect();
        let mut file = NamedTempFile::new()?;
        let mut line_length: Vec<u64> = vec![];
        for (i, line) in entries.iter().enumerate() {
            if i == entries.len() - 1 {
                // last
                write!(file, "{}", line)?;
            } else {
                writeln!(file, "{}", line)?;
            }

            line_length.push(line.len() as u64);
        }
        let p = file.into_temp_path();
        if let Ok(grabber) = Grabber::new(&p, "sourceA") {
            let r = LineRange::from(0..=((entries.len() - 1) as u64));
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
    fn test_grab_all_entries_in_file_with_empty_lines() -> Result<()> {
        check_sample_entries(vec!["", ""])?;
        check_sample_entries(vec!["", "", ""])
    }

    #[test]
    fn test_grab_all_entries_in_file_with_some_empty_lines() -> Result<()> {
        check_sample_entries(vec!["", "a"])
    }

    #[test]
    fn test_get_entries_empty_line_at_end() -> Result<()> {
        use std::io::Write;
        use tempfile::NamedTempFile;
        let mut file = NamedTempFile::new()?;
        write!(file, "ABC")?;
        writeln!(file)?;
        let p = file.into_temp_path();
        let grabber = Grabber::new(&p, "sourceA")?;
        let one_line_empty_range = LineRange::single_line(1);
        let naive = grabber.get_entries(&one_line_empty_range)?;
        let entries: Vec<String> = vec!["".to_owned()];
        assert_eq!(
            naive
                .grabbed_elements
                .into_iter()
                .map(|e| e.content)
                .collect::<Vec<String>>(),
            entries
        );
        Ok(())
    }

    #[test]
    fn test_get_one_line_only() -> Result<()> {
        use std::io::Write;
        use tempfile::NamedTempFile;
        let mut file = NamedTempFile::new()?;
        write!(file, "ABC")?;
        let p = file.into_temp_path();
        let grabber = Grabber::new(&p, "sourceA")?;
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
    fn test_get_lines_problem() -> Result<()> {
        use std::io::Write;
        use tempfile::NamedTempFile;
        let mut file = NamedTempFile::new()?;
        writeln!(file, " 1 testblah")?;
        writeln!(file, " 2 testblah")?;
        writeln!(file, " 3 testblah")?;
        writeln!(file, " 4 testblah")?;
        writeln!(file, " 5 testblah")?;
        writeln!(file, " 6 testblah")?;
        writeln!(file, " 7 testblah")?;
        writeln!(file, " 8 testblah")?;
        writeln!(file, " 9 testblah")?;
        write!(file, "10 testblah")?;
        let p = file.into_temp_path();
        let grabber = Grabber::new(&p, "sourceA")?;

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
    fn test_get_entries_only_empty_lines() -> Result<()> {
        use std::io::Write;
        use tempfile::NamedTempFile;
        let mut file = NamedTempFile::new()?;
        // 3 lines, all empty
        writeln!(file)?;
        writeln!(file)?;
        let p = file.into_temp_path();
        let grabber = Grabber::new(&p, "sourceA")?;
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
