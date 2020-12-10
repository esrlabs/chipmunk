use std::{
    error::Error,
    fs::File,
    io::{BufWriter, Write},
    path::Path,
};

use grep_regex::RegexMatcher;
use grep_searcher::{sinks::UTF8, Searcher};

pub fn search(input: &Path, regex: String, search_output: &Path) -> Result<(), Box<dyn Error>> {
    let matcher = RegexMatcher::new(&regex)?;
    let f = File::create(search_output)?;
    let mut f = BufWriter::new(f);
    Searcher::new().search_path(
        &matcher,
        &input,
        UTF8(|_lnum, line| {
            writeln!(f, "{}", line);
            Ok(true)
        }),
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    const SHERLOCK: &[u8] = b"\
For the Doctor Watsons of this world, as opposed to the Sherlock
Holmeses, success in the province of detective work must always
be, to a very large extent, the result of luck. Sherlock Holmes
can extract a clew from a wisp of straw or a flake of cigar ash;
but Doctor Watson has to have it taken out for him and dusted,
and exhibited clearly, with a label attached.
";
    use super::*;
    use grep_matcher::Matcher;

    #[test]
    fn test_ripgrep_as_library() -> Result<(), std::io::Error> {
        let matcher = RegexMatcher::new(r"Doctor \w+").expect("Could not create regex matcher");
        let mut matches: Vec<(u64, String)> = vec![];
        Searcher::new().search_slice(
            &matcher,
            SHERLOCK,
            UTF8(|lnum, line| {
                // We are guaranteed to find a match, so the unwrap is OK.
                let mymatch = matcher.find(line.as_bytes())?.unwrap();
                matches.push((lnum, line[mymatch].to_string()));
                Ok(true)
            }),
        )?;

        assert_eq!(matches.len(), 2);
        assert_eq!(matches[0], (1, "Doctor Watsons".to_string()));
        assert_eq!(matches[1], (5, "Doctor Watson".to_string()));
        Ok(())
    }
}
