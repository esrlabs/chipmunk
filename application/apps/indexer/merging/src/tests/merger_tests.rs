#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use crate::merger::*;
    use pretty_assertions::assert_eq;
    use std::fs;
    use std::path::PathBuf;
    use tempdir::TempDir;

    test_generator::test_expand_paths! { test_merge_files; "merging/test_samples/*" }

    fn test_merge_files(dir_name: &str) {
        let tmp_dir = TempDir::new("test_dir").expect("could not create temp dir");
        let out_file_path = tmp_dir.path().join("tmpTestFile.txt.out");
        let option_path = PathBuf::from("..").join(&dir_name).join("config.json");
        let append_to_this = PathBuf::from("..").join(&dir_name).join("append_here.log");
        let append_use_case = append_to_this.exists();
        if append_use_case {
            fs::copy(&append_to_this, &out_file_path).expect("copy content failed");
            println!("copied from {:?}", append_to_this);
            let content = fs::read_to_string(append_to_this).expect("could not read file");
            println!("content was: {:?}", content);
            println!("copied content to: {:?}", out_file_path);
            let content2 = fs::read_to_string(&out_file_path).expect("could not read file");
            println!("copied content was: {:?}", content2);
        }

        let merger = Merger {
            chunk_size: 5,
        };
        let merged_lines_cnt = merger.merge_files_use_config_file(
            &option_path,
            &out_file_path,
            append_use_case,
            false, // use stdout
            false, // status reports
        );
        println!("merged_lines_cnt: {:?}", merged_lines_cnt);

        let out_file_content_bytes = fs::read(out_file_path).expect("could not read file");
        let out_file_content = String::from_utf8_lossy(&out_file_content_bytes[..]);
        let mut expected_path = PathBuf::from("..").join(&dir_name);
        expected_path.push("expected.merged");
        let expected_content_bytes = fs::read(expected_path).expect("could not read expected file");
        let expected_content = String::from_utf8_lossy(&expected_content_bytes[..]);
        println!(
            "comparing\n{}\nto expected:\n{}",
            out_file_content, expected_content
        );
        assert_eq!(expected_content, out_file_content);
    }

    // TODO test files with lines without timestamp
}
