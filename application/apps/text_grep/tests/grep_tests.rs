#[cfg(test)]
mod tests {
    use std::fs::File;
    use std::io::Write;
    use std::path::PathBuf;
    use tempfile::tempdir;
    use text_grep::GrepError;
    use text_grep::TextGrep;
    use tokio;
    use tokio::runtime::Runtime;
    use tokio_util::sync::CancellationToken;

    // function to create a temporary test file with given content
    fn create_temp_file(content: &str) -> (PathBuf, String) {
        let temp_dir = tempdir().expect("Failed to create temporary directory");
        let file_path = temp_dir.path().join("test_file.txt");
        let mut file = File::create(&file_path).expect("Failed to create temporary file");
        file.write_all(content.as_bytes())
            .expect("Failed to write to temporary file");
        (
            file_path,
            temp_dir.into_path().to_string_lossy().to_string(),
        )
    }

    #[test]
    fn test_positive_cases() {
        let content = "This is a test file\n\
                       with multiple lines\n\
                       to testtest pattern matching";
        let (file_path, _) = create_temp_file(content);

        let patterns = vec!["test", "multiple", "pattern"];
        let grep = TextGrep::new();
        let runtime = Runtime::new().unwrap();
        let result = runtime.block_on(grep.count_occurrences(
            patterns.iter().map(|&p| p).collect(),
            vec![file_path.to_str().unwrap()],
            false,
            CancellationToken::new(),
        ));

        // Asserting the result
        assert!(result.is_ok());
        let result = result.unwrap();
        assert_eq!(result.len(), 1);
        let search_result = result.into_iter().next().unwrap().unwrap();
        assert_eq!(search_result.file_path, file_path.to_str().unwrap());
        assert_eq!(search_result.error_message, None);
        assert_eq!(search_result.pattern_counts.get("test"), Some(&3));
        assert_eq!(search_result.pattern_counts.get("multiple"), Some(&1));
        assert_eq!(search_result.pattern_counts.get("pattern"), Some(&1));
    }

    #[test]
    fn test_negative_cases() {
        let content = "This is a test file\n\
                       with multiple lines\n\
                       to test pattern matching";
        let (file_path, _) = create_temp_file(content);

        let patterns = vec!["nonexistent", "pattern"];
        let grep = TextGrep::new();
        let runtime = Runtime::new().unwrap();
        let result = runtime.block_on(grep.count_occurrences(
            patterns.iter().map(|&p| p).collect(),
            vec![file_path.to_str().unwrap()],
            false,
            CancellationToken::new(),
        ));

        // Asserting the result
        assert!(result.is_ok());
        let result = result.unwrap();
        assert_eq!(result.len(), 1);
        let search_result = result.into_iter().next().unwrap().unwrap();
        assert_eq!(search_result.file_path, file_path.to_str().unwrap());
        assert_eq!(search_result.error_message, None);
        assert_eq!(search_result.pattern_counts.get("nonexistent"), Some(&0));
        assert_eq!(search_result.pattern_counts.get("pattern"), Some(&1));
    }

    #[test]
    fn test_cancellation() {
        let content = "This is a test file\n\
                       with multiple lines\n\
                       to test pattern matching";
        let (file_path, _) = create_temp_file(content);

        let patterns = vec!["test", "multiple", "pattern"];
        let grep = TextGrep::new();
        let runtime = Runtime::new().unwrap();
        let cancel_token = CancellationToken::new();
        cancel_token.cancel();

        let result = runtime.block_on(grep.count_occurrences(
            patterns.iter().map(|&p| p).collect(),
            vec![file_path.to_str().unwrap()],
            false,
            cancel_token,
        ));

        // Asserting the result
        assert!(matches!(result, Err(GrepError::OperationCancelled)));
    }
}
