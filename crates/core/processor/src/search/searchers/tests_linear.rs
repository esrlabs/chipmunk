use crate::search::{filter::SearchFilter, searchers::linear::LineSearcher};

#[cfg(test)]
const SAMPLES: &[&str] = &[
    "[Info](1.3): a",
    "[Warn](1.4): b",
    "[Info](1.5): c",
    "[Err](1.6): d",
    "[err](1.6): d",
    "[Info](1.7): e",
    "[Info](1.8): f",
    "[warn](1.4): b",
];

#[test]
fn test_linear() -> Result<(), std::io::Error> {
    let cases: Vec<(SearchFilter, &[usize])> = vec![
        (
            SearchFilter::plain(r"[Err]")
                .regex(false)
                .ignore_case(true)
                .word(false),
            &[3, 4],
        ),
        (
            SearchFilter::plain(r"[err]")
                .regex(false)
                .ignore_case(true)
                .word(false),
            &[3, 4],
        ),
        (
            SearchFilter::plain(r"[err]")
                .regex(false)
                .ignore_case(false)
                .word(false),
            &[4],
        ),
        (
            SearchFilter::plain(r"\[Warn\]")
                .regex(true)
                .ignore_case(true)
                .word(false),
            &[1, 7],
        ),
        (
            SearchFilter::plain(r"warn")
                .regex(true)
                .ignore_case(false)
                .word(false),
            &[7],
        ),
    ];
    for (filter, matches) in cases.into_iter() {
        let searcher =
            LineSearcher::new(&filter).map_err(|err| std::io::Error::other(err.to_string()))?;
        for (n, smpl) in SAMPLES.iter().enumerate() {
            if searcher.is_match(smpl) {
                assert!(matches.contains(&n));
            } else {
                assert!(!matches.contains(&n));
            }
        }
    }
    Ok(())
}

#[test]
fn from_filters_matches_any_filter() {
    let filters = [
        SearchFilter::plain("Warn").ignore_case(true),
        SearchFilter::plain("Err").ignore_case(true),
    ];
    let searcher = LineSearcher::from_filters(&filters).unwrap();

    let matched: Vec<usize> = SAMPLES
        .iter()
        .enumerate()
        .filter(|(_, smpl)| searcher.is_match(smpl))
        .map(|(n, _)| n)
        .collect();

    assert_eq!(matched, vec![1, 3, 4, 7]);
}

#[test]
fn from_filters_rejects_empty_filters() {
    assert!(LineSearcher::from_filters(&[]).is_err());
}

#[test]
fn whole_word_matching_rejects_partial_words() {
    let searcher = LineSearcher::new(&SearchFilter::plain("warn").word(true)).unwrap();

    assert!(searcher.is_match("status warn received"));
    assert!(!searcher.is_match("status warning received"));
}

#[test]
fn matching_uses_visible_ansi_text() {
    let searcher = LineSearcher::new(&SearchFilter::plain("warn").word(true)).unwrap();

    assert!(searcher.is_match("status w\x1b[31marn received"));
    assert!(!searcher.is_match("status w\x1b[31marning received"));
}

#[test]
fn matching_ignores_ansi_sequence_text() {
    let searcher = LineSearcher::new(&SearchFilter::plain("31m")).unwrap();

    assert!(searcher.is_match("status 31m warn received"));
    assert!(!searcher.is_match("status \x1b[31mwarn received"));
}
