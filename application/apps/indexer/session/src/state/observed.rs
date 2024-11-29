use std::path::PathBuf;

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

    pub fn is_file_based_export_possible(&self) -> bool {
        let mut possibility = true;
        self.executed.iter().for_each(|opt| {
            if matches!(opt.origin, stypes::ObserveOrigin::Stream(..)) {
                possibility = false;
            }
        });
        possibility
    }

    pub fn get_files(&self) -> Vec<(stypes::ParserType, stypes::FileFormat, PathBuf)> {
        let mut files: Vec<(stypes::ParserType, stypes::FileFormat, PathBuf)> = vec![];
        self.executed.iter().for_each(|opt| match &opt.origin {
            stypes::ObserveOrigin::File(_, file_format, filename) => {
                files.push((opt.parser.clone(), file_format.clone(), filename.clone()))
            }
            stypes::ObserveOrigin::Concat(list) => {
                files.append(
                    &mut list
                        .iter()
                        .map(|(_, file_format, filename)| {
                            (opt.parser.clone(), file_format.clone(), filename.clone())
                        })
                        .collect::<Vec<(stypes::ParserType, stypes::FileFormat, PathBuf)>>(),
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
