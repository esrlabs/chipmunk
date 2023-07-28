use sources::factory::{FileFormat, ObserveOptions, ObserveOrigin, ParserType};
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

    pub fn get_files(&self) -> Vec<(ParserType, FileFormat, PathBuf)> {
        let mut files: Vec<(ParserType, FileFormat, PathBuf)> = vec![];
        self.executed.iter().for_each(|opt| match &opt.origin {
            ObserveOrigin::File(_, file_format, filename) => {
                files.push((opt.parser.clone(), file_format.clone(), filename.clone()))
            }
            ObserveOrigin::Concat(list) => {
                files.append(
                    &mut list
                        .iter()
                        .map(|(_, file_format, filename)| {
                            (opt.parser.clone(), file_format.clone(), filename.clone())
                        })
                        .collect::<Vec<(ParserType, FileFormat, PathBuf)>>(),
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
