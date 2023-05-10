use sources::factory::{ObserveOptions, ObserveOrigin, ParserType};
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Observed {
    pub executed: Vec<ObserveOptions>,
}

impl Observed {
    pub fn new() -> Self {
        Self { executed: vec![] }
    }

    pub fn add(&mut self, options: ObserveOptions) {
        self.executed.push(options);
    }

    pub fn is_file_based_export_possible(&self) -> bool {
        let mut possibility = true;
        self.executed.iter().for_each(|opt| {
            if matches!(opt.origin, ObserveOrigin::Stream(..)) {
                possibility = false;
            }
        });
        possibility
    }

    pub fn get_files(&self) -> Vec<(ParserType, PathBuf)> {
        let mut files: Vec<(ParserType, PathBuf)> = vec![];
        self.executed.iter().for_each(|opt| match &opt.origin {
            ObserveOrigin::File(_, _, filename) => {
                files.push((opt.parser.clone(), filename.clone()))
            }
            ObserveOrigin::Concat(list) => {
                files.append(
                    &mut list
                        .iter()
                        .map(|(_, filename)| (opt.parser.clone(), filename.clone()))
                        .collect::<Vec<(ParserType, PathBuf)>>(),
                );
            }
            _ => {}
        });
        files
    }
}

impl Default for Observed {
    fn default() -> Self {
        Self::new()
    }
}
