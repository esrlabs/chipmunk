use std::path::PathBuf;

/// Collection of executed observe (source + parser) operations.
#[derive(Debug, Clone)]
pub struct Observed {
    pub executed: Vec<stypes::ObserveOptions>,
}

impl Observed {
    pub fn new() -> Self {
        Self { executed: vec![] }
    }

    pub fn add(&mut self, options: stypes::ObserveOptions) {
        self.executed.push(options);
    }

    /// Check any of the executed observe operations supports file (raw) export function.
    pub fn is_file_based_export_possible(&self) -> bool {
        is_raw_export_available_for(&self.executed)
    }

    /// Get sources of type file form the already executed observe operations.
    pub fn get_files(&self) -> Vec<(stypes::ParserType, stypes::FileFormat, PathBuf)> {
        let mut files: Vec<(stypes::ParserType, stypes::FileFormat, PathBuf)> = vec![];
        self.executed.iter().for_each(|opt| match &opt.origin {
            stypes::ObserveOrigin::File(_, file_format, filename) => {
                files.push((opt.parser.clone(), *file_format, filename.clone()))
            }
            stypes::ObserveOrigin::Concat(list) => {
                files.append(
                    &mut list
                        .iter()
                        .map(|(_, file_format, filename)| {
                            (opt.parser.clone(), *file_format, filename.clone())
                        })
                        .collect::<Vec<(stypes::ParserType, stypes::FileFormat, PathBuf)>>(),
                );
            }
            _ => {}
        });
        files
    }
}

pub fn is_raw_export_available_for(options: &[stypes::ObserveOptions]) -> bool {
    options.iter().all(|opt| {
        !matches!(
            (&opt.origin, &opt.parser),
            (stypes::ObserveOrigin::Stream(..), _) | (_, stypes::ParserType::Plugin(..))
        )
    })
}

impl Default for Observed {
    fn default() -> Self {
        Self::new()
    }
}
