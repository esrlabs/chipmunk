#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    extern crate rand;
    extern crate tempdir;
    use crate::processor::*;
    use indexer_base::chunks::Chunk;
    use indexer_base::config::IndexingConfig;
    use pretty_assertions::assert_eq;
    use std::fs;
    use std::fs::File;
    use std::path::PathBuf;
    use tempdir::TempDir;

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
        let chunks = create_index_and_mapping(IndexingConfig {
            tag: tag_name,
            chunk_size: chunksize,
            in_file: f,
            out_path: &out_file_path,
            append: tmp_file_name.is_some(),
            source_file_size,
            to_stdout: false,
            status_updates: true,
        })
        .unwrap();
        let out_file_content: String =
            fs::read_to_string(out_file_path).expect("could not read file");

        // cleanup
        let _ = tmp_dir.close();

        // println!("out_file_content: {}", out_file_content);
        // println!("got chunks: {:?}", chunks);
        (chunks, out_file_content)
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
        let nonempty_file_path = tmp_dir.path().join("not_empty.log");
        let empty_file_path = tmp_dir.path().join("empty.log");
        fs::write(&nonempty_file_path, "A").unwrap();
        // call our function
        fs::write(&empty_file_path, "").expect("testfile could not be written");
        let empty_file = File::open(empty_file_path).unwrap();
        let out_path = tmp_dir.path().join("test_append_to_empty_output.log.out");
        // let indexer = Indexer {
        //     source_id: "tag".to_string(), // tag to append to each line
        //     chunk_size: 1,                // used for mapping line numbers to byte positions
        // };
        let source_file_size = empty_file.metadata().unwrap().len() as usize;
        // let chunks = indexer
        //     .index_file(&empty_file, &out_path, false, source_file_size, false)
        let chunks = create_index_and_mapping(IndexingConfig {
            tag: "tag",
            chunk_size: 1,
            in_file: empty_file,
            out_path: &out_path,
            append: false,
            source_file_size,
            to_stdout: false,
            status_updates: true,
        })
        .expect("could not index file");
        assert_eq!(0, chunks.len(), "empty file should produce 0 chunks");
        let out_file_content: String = fs::read_to_string(&out_path).expect("could not read file");
        assert_eq!(
            0,
            out_file_content.len(),
            "empty file should produce empty output"
        );
        let nonempty_file = File::open(nonempty_file_path).unwrap();
        // let chunks2 = indexer
        //     .index_file(&nonempty_file, &out_path, true, nonempty_file_size, false)
        //     .expect("could not index file");
        let chunks2 = create_index_and_mapping(IndexingConfig {
            tag: "tag",
            chunk_size: 1,
            in_file: nonempty_file,
            out_path: &out_path,
            append: true,
            source_file_size,
            to_stdout: false,
            status_updates: true,
        })
        .unwrap();
        let out_file_content: String = fs::read_to_string(out_path).expect("could not read file");
        println!("outfile: {}\nchunks: {:?}", out_file_content, chunks2);
        assert_eq!(
            1,
            chunks2.len(),
            "nonempty file should produce nonempty output"
        );
        assert_eq!(0, chunks2[0].r.0, "first chunk row should start with 0");
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
        let chunks = create_index_and_mapping(IndexingConfig {
            tag: "TAG",
            chunk_size: 1,
            in_file,
            out_path: &out_file_path,
            append: append_use_case,
            source_file_size: in_file_size,
            to_stdout: false,
            status_updates: true,
        })
        .unwrap();
        let out_file_content_bytes = fs::read(out_file_path).expect("could not read file");
        let out_file_content = String::from_utf8_lossy(&out_file_content_bytes[..]);
        let expected_path = PathBuf::from("..").join(&dir_name).join("expected.output");
        let expected_content_bytes = fs::read(expected_path).expect("could not read expected file");
        let expected_content = String::from_utf8_lossy(&expected_content_bytes[..]);
        println!(
            "comparing\n{}\nto expected:\n{}",
            out_file_content, expected_content
        );
        assert_eq!(expected_content.trim_end(), out_file_content.trim_end());
        assert_eq!(true, chunks_fit_together(&chunks), "chunks need to fit");
    }

}
