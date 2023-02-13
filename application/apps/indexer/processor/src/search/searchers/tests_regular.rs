use crate::{map::FilterMatch, search::filter::SearchFilter};
use std::io::{Error, ErrorKind, Write};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use super::{regular, BaseSearcher};

#[cfg(test)]
const LOGS: &[&str] = &[
    "[Info](1.3): a",
    "[Warn](1.4): b",
    "[Info](1.5): c",
    "[Err](1.6): d",
    "[Info](1.7): e",
    "[Info](1.8): f",
];

// create tmp file with content, apply search
fn filtered(content: &str, filters: Vec<SearchFilter>) -> Result<Vec<FilterMatch>, std::io::Error> {
    let mut tmp_file = tempfile::NamedTempFile::new()?;
    let input_file = tmp_file.as_file_mut();
    input_file.write_all(content.as_bytes())?;
    let file_size = input_file.metadata()?.len();
    let mut searcher = BaseSearcher::new(tmp_file.path(), Uuid::new_v4(), 0, 0);
    let (_range, indexes, _stats) = regular::execute_fresh_filter_search(
        &mut searcher,
        filters,
        0,
        file_size,
        CancellationToken::new(),
    )
    .map_err(|e| Error::new(ErrorKind::Other, format!("Error in search: {e}")))?;
    Ok(indexes)
}

#[test]
fn test_ripgrep_regex_non_regex() -> Result<(), std::io::Error> {
    let filters = vec![
        SearchFilter::plain(r"[Err]")
            .regex(false)
            .ignore_case(true)
            .word(false),
        SearchFilter::plain(r"\[Warn\]")
            .regex(true)
            .ignore_case(true)
            .word(false),
    ];

    let matches = filtered(&LOGS.join("\n"), filters)?;
    assert_eq!(2, matches.len());
    assert_eq!(1, matches[0].index);
    assert_eq!(3, matches[1].index);
    Ok(())
}

#[test]
fn test_ripgrep_case_sensitivity() -> Result<(), std::io::Error> {
    let filters = vec![
        SearchFilter::plain(r"[err]")
            .regex(false)
            .ignore_case(true)
            .word(false),
        SearchFilter::plain(r"[warn]")
            .regex(false)
            .ignore_case(false)
            .word(false),
    ];

    let matches = filtered(&LOGS.join("\n"), filters)?;
    assert_eq!(1, matches.len());
    assert_eq!(3, matches[0].index);
    Ok(())
}
