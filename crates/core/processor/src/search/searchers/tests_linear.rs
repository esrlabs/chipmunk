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
