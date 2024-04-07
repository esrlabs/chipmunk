# text_grep

`text_grep` is a crate for searching text patterns within files using regular expressions.

This crate provides functionality to search for multiple patterns within multiple files concurrently.
It supports both case-sensitive and case-insensitive search modes.

## Examples

```rust
use std::path::PathBuf;
use text_grep::count_occurrences;
use tokio_util::sync::CancellationToken;

#[tokio::main]
async fn main() {
    // Patterns to search for
    let patterns = ["text", "administrator", "HTTP"];

    // File paths to search within
    let file_paths = [
        PathBuf::from("indexing_access_huge.log"),
        PathBuf::from("indexing_access_huge.log"),
        PathBuf::from("Cargo.toml"),
    ];

    // Create a cancellation token
    let cancel_token = CancellationToken::new();

    // Perform the search
    match count_occurrences(
        &patterns,
        &file_paths.iter().collect::<Vec<&PathBuf>>(),
        true,
        cancel_token,
    )
    .await
    {
        Ok(results) => {
            for result in results {
                match result {
                    Ok(search_result) => {
                        // Process successful search result
                        println!("{:?}", search_result);
                    }
                    Err(err) => {
                        // Handle error
                        eprintln!("Error: {}", err);
                    }
                }
            }
        }
        Err(err) => {
            // Handle error
            eprintln!("Error: {}", err);
        }
    }
}
```

## Public Functions

- `count_occurrences`: Asynchronously searches for multiple patterns within multiple files.
  - Parameters:
    - `patterns`: An array of string slices representing patterns to search for.
    - `file_paths`: An array of `PathBuf` representing paths to files to search within.
    - `case_sensitive`: A boolean indicating whether the search should be case-sensitive or not.
    - `cancel_token`: A `CancellationToken` used for cancellation of the operation.
  - Returns:
    - `Result<Vec<Result<SearchResult, GrepError>>, GrepError>`: A vector of results containing either `SearchResult` or `GrepError`.

## Error Handling

- `GrepError` represents various errors that may occur during the search process.
  - `NotATextFile`: Indicates that a file is not a text file.
  - `FileReadError`: Indicates an error occurred while reading a file.
  - `FileProcessingError`: Indicates an error occurred while processing a file.
  - `OperationCancelled`: Indicates that the operation was cancelled.
  - `BuilingRegExError`: Indicates an error occurred while building a regular expression for searching.
  - `RegExError`: Indicates an error occurred with a regular expression.
  - `IOError`: Indicates an I/O error occurred.

## Types

- `SearchResult`: Represents the result of searching within a file.
  - `file_path`: A `String` representing the path of the file.
  - `pattern_counts`: A `HashMap` containing the counts of occurrences of each pattern within the file.
  - `error_message`: An optional `String` containing an error message if any error occurred during the search.

## Modules

- `buffer`: Module for handling buffered I/O.
- `GrepError`: Module defining custom error types for the crate.

## Dependencies

- `buf_redux`: Provides buffered I/O functionality.
- `grep_regex`: Facilitates regular expression searching.
- `grep_searcher`: Implements file searching capabilities.
- `regex`: Provides regular expression support.
- `thiserror`: Simplifies error handling.

## Additional Notes

- This crate assumes that all files are text files.
- It utilizes asynchronous operations for efficiency, particularly in handling large files.
- Cancellation of ongoing operations is supported using a `CancellationToken`.
- Errors are handled using the `GrepError` enum, providing detailed error information.
- Regular expressions for searching are constructed dynamically based on user-provided patterns.
- Both case-sensitive and case-insensitive searches are supported based on user preference.
