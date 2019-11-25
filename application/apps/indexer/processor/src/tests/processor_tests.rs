#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    extern crate rand;
    extern crate tempdir;
    use indexer_base::chunks::ChunkResults;
    use crate::processor::*;
    use indexer_base::chunks::Chunk;
    use indexer_base::config::IndexingConfig;
    use indexer_base::progress::{IndexingProgress, Notification};
    use pretty_assertions::assert_eq;
    use std::fs;
    use std::fs::File;
    use std::path::PathBuf;
    use tempdir::TempDir;
    use crossbeam_channel::unbounded;
    use crossbeam_channel as cc;

    fn get_chunks(
        test_content: &str,
        chunksize: usize,
        tag_name: &str,
        tmp_file_name: Option<&str>,
    ) -> (Vec<Chunk>, String) {
        let tmp_dir = TempDir::new("test_dir").expect("could not create temp dir");
        let test_file_path = tmp_dir.path().join("tmpTestFile.txt");
        let out_file_path = tmp_dir.path().join("tmpTestFile.txt.out");
        fs::write(&test_file_path, test_content).expect("testfile could not be written");

        // call our function
        let f = File::open(&test_file_path).unwrap();
        let source_file_size = f.metadata().unwrap().len() as usize;

        let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
        create_index_and_mapping(
            IndexingConfig {
                tag: tag_name,
                chunk_size: chunksize,
                in_file: f,
                out_path: &out_file_path,
                append: tmp_file_name.is_some(),
            },
            false,
            Some(source_file_size),
            tx,
            None,
        )
        .unwrap();
        let out_file_content: String =
            fs::read_to_string(out_file_path).expect("could not read file");

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
        // println!("out_file_content: {}", out_file_content);
        // println!("got chunks: {:?}", chunks);
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

    #[test]
    fn test_append_to_empty_output() {
        let tmp_dir = TempDir::new("my_directory_prefix").expect("could not create temp dir");
        let empty_file_path = tmp_dir.path().join("empty.log");
        // call our function
        fs::write(&empty_file_path, "").expect("testfile could not be written");
        let empty_file = File::open(empty_file_path).unwrap();
        let out_path = tmp_dir.path().join("test_append_to_empty_output.log.out");
        let source_file_size = empty_file.metadata().unwrap().len() as usize;

        let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
        create_index_and_mapping(
            IndexingConfig {
                tag: "tag",
                chunk_size: 1,
                in_file: empty_file,
                out_path: &out_path,
                append: false,
            },
            false,
            Some(source_file_size),
            tx,
            None,
        )
        .expect("could not index file");

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
        let nonempty_file = File::open(nonempty_file_path).unwrap();
        let source_file_size = nonempty_file.metadata().unwrap().len() as usize;
        let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
        create_index_and_mapping(
            IndexingConfig {
                tag: "tag",
                chunk_size: 1,
                in_file: nonempty_file,
                out_path: &out_path,
                append: true,
            },
            false,
            Some(source_file_size),
            tx,
            None,
        )
        .unwrap();
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
    }
    #[test]
    fn test_chunking_one_chunk_exact() {
        let (chunks, content) = get_chunks("A\n", 1, "some_new_tag", None);
        println!("chunks: {:?}", chunks);
        println!("content: {:02X?}", content.as_bytes());
        assert_eq!(1, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_one_chunk_to_big() {
        let (chunks, content) = get_chunks("A\n", 2, "tag_ok", None);
        println!("chunks: {:?}", chunks);
        println!("content: {:02X?}", content.as_bytes());
        assert_eq!(1, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_one_chunk_exact_no_nl() {
        let (chunks, content) = get_chunks("A", 1, "tag_no_nl", None);
        assert_eq!(1, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_multiple_chunks_partly() {
        let (chunks, content) = get_chunks("A\nB\nC", 2, "T", None);
        println!("chunks: {:?}", chunks);
        println!(
            "content ({} bytes): {:02X?}",
            content.as_bytes().len(),
            content.as_bytes()
        );
        assert_eq!(2, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_multiple_chunks_complete() {
        let (chunks, content) = get_chunks("A\nB\nC\nD\n", 2, "tag_chunk_complet", None);
        assert_eq!(2, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_multiple_chunks_complete_no_nl() {
        let (chunks, content) = get_chunks("A\nB\nC\nD", 2, "tag_complete_no_nl", None);
        println!("chunks: {:?}", chunks);
        println!("content: {:02X?}", content.as_bytes());
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
        let in_file = File::open(in_path).expect("in.txt file not found");
        let tmp_dir = TempDir::new("test_dir").expect("could not create temp dir");
        let out_file_path = tmp_dir.path().join("tmpTestFile.txt.out");
        let in_file_size = in_file.metadata().unwrap().len() as usize;
        let append_to_this = PathBuf::from("..").join(&dir_name).join("append_here.log");
        let append_use_case = append_to_this.exists();

        if append_use_case {
            println!("append use case...trying to append to {:?}", append_to_this);
            fs::copy(&append_to_this, &out_file_path).expect("copy content failed");
            println!("copied from {:?}", append_to_this);
            let content = fs::read_to_string(append_to_this).expect("could not read file");
            println!("content was: {:?}", content);
            println!("copied content to: {:?}", out_file_path);
            let content2 = fs::read_to_string(&out_file_path).expect("could not read file");
            println!("copied content was: {:?}", content2);
        }
        let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
        create_index_and_mapping(
            IndexingConfig {
                tag: "TAG",
                chunk_size: 1,
                in_file,
                out_path: &out_file_path,
                append: append_use_case,
            },
            false,
            Some(in_file_size),
            tx,
            None,
        )
        .unwrap();
        let mut chunks: Vec<Chunk> = vec![];
        loop {
            match rx.recv() {
                Ok(Ok(IndexingProgress::Finished { .. })) => {
                    trace!("finished...");
                    let out_file_content_bytes =
                        fs::read(out_file_path).expect("could not read file");
                    let out_file_content = String::from_utf8_lossy(&out_file_content_bytes[..]);
                    let expected_path = PathBuf::from("..").join(&dir_name).join("expected.output");
                    let expected_content_bytes =
                        fs::read(expected_path).expect("could not read expected file");
                    let expected_content = String::from_utf8_lossy(&expected_content_bytes[..]);
                    println!(
                        "comparing\n{}\nto expected:\n{}",
                        out_file_content, expected_content
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
    }
}
