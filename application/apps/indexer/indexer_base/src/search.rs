use std::path::PathBuf;
use std::{
    error::Error,
    fs::File,
    io::{BufWriter, Write},
};

use grep_regex::RegexMatcher;
use grep_searcher::{sinks::UTF8, Searcher};

pub struct SearchHolder {
    pub file_path: PathBuf,
    pub out_file_path: PathBuf,
    // pub handler: Option<EventHandler>,
    // pub shutdown_channel: Channel<()>,
    // pub event_channel: Channel<IndexingResults<()>>,
}

impl SearchHolder {
    pub fn search(&self, regex: String) -> Result<PathBuf, Box<dyn Error>> {
        println!(
            "Search {} in {:?}, put out to {:?}",
            regex, self.file_path, self.out_file_path
        );
        let matcher = RegexMatcher::new(&regex)?;
        let out_file = File::create(&self.out_file_path)?;
        let mut writer = BufWriter::new(out_file);
        Searcher::new().search_path(
            &matcher,
            &self.file_path,
            UTF8(|_lnum, line| {
                writeln!(writer, "{}", line);
                Ok(true)
            }),
        )?;

        Ok(self.out_file_path.clone())
    }
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
