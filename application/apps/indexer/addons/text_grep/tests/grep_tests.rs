#[cfg(test)]
mod tests {
    use std::fs::File;
    use std::io::Write;
    use std::path::PathBuf;
    use tempfile::tempdir;
    use text_grep::{count_occurrences, GrepError, GrepError::RegExError};
    use tokio_util::sync::CancellationToken;

    // Function to create a temporary test file with given content
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

    #[tokio::test]
    async fn test_positive_cases() {
        let content = "This is a test file\n\
                       with multiple lines\n\
                       to testtest pattern matching";
        let (file_path, _) = create_temp_file(content);

        let patterns = vec!["test", "multiple", "pattern"];
        let cancel_token = CancellationToken::new();
        let result = count_occurrences(&patterns, &[&file_path], false, cancel_token.clone()).await;

        // Asserting the result
        assert!(result.is_ok(), "Result is not Ok");
        let result = result.unwrap();
        assert_eq!(result.len(), 1);
        let search_result = result.into_iter().next().unwrap();
        match search_result {
            Ok(search_result) => {
                assert_eq!(search_result.file_path, file_path.to_str().unwrap());
                assert_eq!(search_result.error_message, None);
                assert_eq!(search_result.pattern_counts.get("test"), Some(&3));
                assert_eq!(search_result.pattern_counts.get("multiple"), Some(&1));
                assert_eq!(search_result.pattern_counts.get("pattern"), Some(&1));
            }
            Err(err) => panic!("Error occurred: {:?}", err),
        }
    }

    #[tokio::test]
    async fn test_negative_cases() {
        let content = "This is a test file\n\
                       with multiple lines\n\
                       to test pattern matching";
        let (file_path, _) = create_temp_file(content);

        let patterns = vec!["nonexistent", "pattern"];
        let cancel_token = CancellationToken::new();
        let result = count_occurrences(&patterns, &[&file_path], false, cancel_token.clone()).await;

        // Asserting the result
        assert!(result.is_ok(), "Result is not Ok");
        let result = result.unwrap();
        assert_eq!(result.len(), 1);
        let search_result = result.into_iter().next().unwrap();
        match search_result {
            Ok(search_result) => {
                assert_eq!(search_result.file_path, file_path.to_str().unwrap());
                assert_eq!(search_result.error_message, None);
                assert_eq!(search_result.pattern_counts.get("nonexistent"), Some(&0));
                assert_eq!(search_result.pattern_counts.get("pattern"), Some(&1));
            }
            Err(err) => panic!("Error occurred: {:?}", err),
        }
    }

    #[tokio::test]
    async fn test_case_insensitivity() {
        let content = "This is a test file\n\
                       with multiple lines\n\
                       to test pattern matching";
        let (file_path, _) = create_temp_file(content);

        let patterns = vec!["TEST", "MULTIPLE", "PATTERN"];
        let cancel_token = CancellationToken::new();
        let result = count_occurrences(&patterns, &[&file_path], false, cancel_token.clone()).await;

        // Asserting the result
        assert!(result.is_ok(), "Result is not Ok");
        let result = result.unwrap();
        assert_eq!(result.len(), 1);
        let search_result = result.into_iter().next().unwrap();
        match search_result {
            Ok(search_result) => {
                assert_eq!(search_result.file_path, file_path.to_str().unwrap());
                assert_eq!(search_result.error_message, None);
                assert_eq!(search_result.pattern_counts.get("TEST"), Some(&2));
                assert_eq!(search_result.pattern_counts.get("MULTIPLE"), Some(&1));
                assert_eq!(search_result.pattern_counts.get("PATTERN"), Some(&1));
            }
            Err(err) => panic!("Error occurred: {:?}", err),
        }
    }

    #[tokio::test]
    async fn test_cancellation() {
        let content = "This is a test file\n\
                       with multiple lines\n\
                       to test pattern matching";
        let (file_path, _) = create_temp_file(content);

        let patterns = vec!["test", "multiple", "pattern"];
        let cancel_token = CancellationToken::new();
        cancel_token.cancel();

        let result = count_occurrences(&patterns, &[&file_path], false, cancel_token.clone()).await;

        // Asserting the result
        assert!(
            matches!(result, Err(GrepError::OperationCancelled)),
            "Result is not Err(OperationCancelled)"
        );
    }

    #[tokio::test]
    async fn test_invalid_patterns() {
        let content = "This is a test file\n\
                       with multiple lines\n\
                       to test pattern matching";
        let (file_path, _) = create_temp_file(content);

        let patterns = vec!["(unclosed group", "[invalid character class"];
        let cancel_token = CancellationToken::new();
        let result = count_occurrences(&patterns, &[&file_path], false, cancel_token.clone()).await;

        // Asserting the result
        assert!(
            matches!(result, Err(RegExError(_error))),
            "Result is not Err(RegExError)"
        );
    }
}
