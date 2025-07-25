// #![deny(unused_crate_dependencies)]
// Copyright (c) 2019 E.S.R.Labs. All rights reserved.
//
// NOTICE:  All information contained herein is, and remains
// the property of E.S.R.Labs and its suppliers, if any.
// The intellectual and technical concepts contained herein are
// proprietary to E.S.R.Labs and its suppliers and may be covered
// by German and Foreign Patents, patents in process, and are protected
// by trade secret or copyright law.
// Dissemination of this information or reproduction of this material
// is strictly forbidden unless prior written permission is obtained
// from E.S.R.Labs.
#[macro_use]
extern crate log;

use parsers::api::*;
use processor::producer::{MessageProducer, MessageStreamItem};
use session::session::Session;
use std::{
    collections::HashMap,
    fs::File,
    io::{BufWriter, Write},
    path::{Path, PathBuf},
};
use stypes::{SessionAction, SessionSetup};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(Default)]
pub struct AttachmentsCollector {
    pub attachments: Vec<Attachment>,
    messages: usize,
}

impl LogRecordsBuffer for AttachmentsCollector {
    fn append(&mut self, record: LogRecordOutput<'_>) {
        match record {
            LogRecordOutput::Raw(..)
            | LogRecordOutput::Message(..)
            | LogRecordOutput::Columns(..) => {
                self.messages += 1;
            }
            LogRecordOutput::Multiple(inner) => {
                for rec in inner {
                    self.append(rec);
                }
            }
            LogRecordOutput::Attachment(inner) => {
                self.attachments.push(inner);
            }
        }
    }

    async fn flush(&mut self) -> Result<(), stypes::NativeError> {
        Ok(())
    }

    fn get_source_id(&self) -> u16 {
        0
    }
}

pub async fn scan_dlt_ft(
    filename: PathBuf,
    filters: Option<HashMap<String, Vec<String>>>,
    cancel: CancellationToken,
) -> Result<Vec<Attachment>, String> {
    let setup = SessionSetup {
        origin: SessionAction::File(filename),
        parser: parsers::dlt::descriptor::get_default_options(None, filters),
        source: sources::binary::raw::get_default_options(),
    };
    let (session, receiver) = Session::new(Uuid::new_v4())
        .await
        .map_err(|err| err.to_string())?;
    let (_, source, parser) = session
        .register
        .setup(&setup)
        .map_err(|err| err.to_string())?;
    let mut collector = AttachmentsCollector::default();
    let mut producer = MessageProducer::new(parser, source, &mut collector);
    let mut canceled = false;
    loop {
        tokio::select! {
            // Check on events in current order ensuring cancel will be checked at first
            // as it's defined in the current unit tests.
            biased;
            _ = cancel.cancelled() => {
                debug!("scan canceled");
                canceled = true;
                break;
            }
            item = producer.read_next_segment() => {
                match item {
                    Some((_, MessageStreamItem::Done)) | None => {
                        break;
                    },
                    Some(..) => {
                        continue;
                    },
                }
            }
        }
    }
    if canceled {
        return Ok(Vec::new());
    }
    // Keep receiver alive until here
    drop(receiver);
    Ok(collector.attachments)
}

pub fn extract_dlt_ft(
    output: &Path,
    files_with_names: Vec<(Attachment, String)>,
    cancel: CancellationToken,
) -> Result<usize, String> {
    let mut result: usize = 0;

    let mut canceled = false;
    for (file, name) in files_with_names {
        if cancel.is_cancelled() {
            debug!("extract canceled");
            canceled = true;
            break;
        }

        let mut out = BufWriter::new(
            File::create(output.join(name)).map_err(|e| format!("Error opening file: {e}"))?,
        );

        let data = &file.data;
        out.write_all(data)
            .map_err(|e| format!("Failed to write attachement data: {e}"))?;
        result += data.len();
    }

    if canceled {
        return Ok(0);
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use parsers::dlt::attachment::{FileExtractor, TempDir};

    use super::*;
    use std::path::Path;

    const DLT_FT_SAMPLE: &str = "../../../../developing/resources/attachments.dlt";

    #[tokio::test]
    async fn test_scan_dlt_ft() {
        let input: PathBuf = Path::new(DLT_FT_SAMPLE).into();

        let cancel = CancellationToken::new();
        match scan_dlt_ft(input, None, cancel).await {
            Ok(files) => {
                assert_eq!(files.len(), 3);
                assert_eq!("test1.txt", files.first().unwrap().name);
                assert_eq!("test2.txt", files.get(1).unwrap().name);
                assert_eq!("test3.txt", files.get(2).unwrap().name);
            }
            Err(error) => {
                panic!("{}", format!("{error}"));
            }
        }
    }

    #[tokio::test]
    async fn test_scan_dlt_ft_canceled() {
        let input: PathBuf = Path::new(DLT_FT_SAMPLE).into();

        let cancel = CancellationToken::new();
        cancel.cancel();

        match scan_dlt_ft(input, None, cancel).await {
            Ok(files) => {
                assert_eq!(files.len(), 0);
            }
            Err(error) => {
                panic!("{}", format!("{error}"));
            }
        }
    }

    #[tokio::test]
    async fn test_scan_dlt_ft_with_filter() {
        let input: PathBuf = Path::new(DLT_FT_SAMPLE).into();
        let mut filters = HashMap::new();
        filters.insert("ecu_ids".to_string(), vec!["ecu2".to_string()]);
        let cancel = CancellationToken::new();
        match scan_dlt_ft(input, Some(filters), cancel).await {
            Ok(files) => {
                assert_eq!(files.len(), 1);
                assert_eq!("test2.txt", files.first().unwrap().name);
            }
            Err(error) => {
                panic!("{}", format!("{error}"));
            }
        }
    }

    #[tokio::test]
    async fn test_extract_dlt_ft() {
        let input: PathBuf = Path::new(DLT_FT_SAMPLE).into();
        let output = TempDir::new();

        let cancel = CancellationToken::new();
        match scan_dlt_ft(input.clone(), None, cancel.clone()).await {
            Ok(files) => {
                match extract_dlt_ft(
                    &output.dir,
                    FileExtractor::files_with_names_prefixed(files),
                    cancel,
                ) {
                    Ok(size) => {
                        assert_eq!(size, 18);
                    }
                    Err(error) => {
                        panic!("{}", format!("{error}"));
                    }
                }
            }
            Err(error) => {
                panic!("{}", format!("{error}"));
            }
        }

        output.assert_file("00000000_test1.txt", "test1");
        output.assert_file("00000001_test2.txt", "test22");
        output.assert_file("00000002_test3.txt", "test333");
    }

    #[tokio::test]
    async fn test_extract_dlt_ft_canceled() {
        let input: PathBuf = Path::new(DLT_FT_SAMPLE).into();
        let output = TempDir::new();

        let cancel = CancellationToken::new();
        match scan_dlt_ft(input.clone(), None, cancel).await {
            Ok(files) => {
                let cancel = CancellationToken::new();
                cancel.cancel();
                match extract_dlt_ft(&output.dir, FileExtractor::files_with_names(files), cancel) {
                    Ok(size) => {
                        assert_eq!(size, 0);
                    }
                    Err(error) => {
                        panic!("{}", format!("{error}"));
                    }
                }
            }
            Err(error) => {
                panic!("{}", format!("{error}"));
            }
        }
    }

    #[tokio::test]
    async fn test_extract_dlt_ft_with_filter() {
        let input: PathBuf = Path::new(DLT_FT_SAMPLE).into();
        let output = TempDir::new();
        let mut filters = HashMap::new();
        filters.insert("ecu_ids".to_string(), vec!["ecu2".to_string()]);
        let cancel = CancellationToken::new();
        match scan_dlt_ft(input.clone(), Some(filters), cancel).await {
            Ok(files) => {
                let cancel = CancellationToken::new();
                match extract_dlt_ft(&output.dir, FileExtractor::files_with_names(files), cancel) {
                    Ok(size) => {
                        assert_eq!(size, 6);
                    }
                    Err(error) => {
                        panic!("{}", format!("{error}"));
                    }
                }
            }
            Err(error) => {
                panic!("{}", format!("{error}"));
            }
        }

        output.assert_file("test2.txt", "test22");
    }

    #[tokio::test]
    async fn test_extract_dlt_ft_with_index() {
        let input: PathBuf = Path::new(DLT_FT_SAMPLE).into();
        let output = TempDir::new();

        let cancel = CancellationToken::new();
        match scan_dlt_ft(input.clone(), None, cancel).await {
            Ok(files) => {
                let cancel = CancellationToken::new();
                match extract_dlt_ft(
                    &output.dir,
                    FileExtractor::files_with_names(vec![files.get(1).unwrap().clone()]),
                    cancel,
                ) {
                    Ok(size) => {
                        assert_eq!(size, 6);
                    }
                    Err(error) => {
                        panic!("{}", format!("{error}"));
                    }
                }
            }
            Err(error) => {
                panic!("{}", format!("{error}"));
            }
        }

        output.assert_file("test2.txt", "test22");
    }

    #[tokio::test]
    async fn test_extract_dlt_ft_with_filtered_index() {
        let input: PathBuf = Path::new(DLT_FT_SAMPLE).into();
        let output = TempDir::new();
        let mut filters = HashMap::new();
        filters.insert("ecu_ids".to_string(), vec!["ecu2".to_string()]);
        let cancel = CancellationToken::new();
        match scan_dlt_ft(input.clone(), Some(filters), cancel).await {
            Ok(files) => {
                let cancel = CancellationToken::new();
                match extract_dlt_ft(&output.dir, FileExtractor::files_with_names(files), cancel) {
                    Ok(size) => {
                        assert_eq!(size, 6);
                    }
                    Err(error) => {
                        panic!("{}", format!("{error}"));
                    }
                }
            }
            Err(error) => {
                panic!("{}", format!("{error}"));
            }
        }

        output.assert_file("test2.txt", "test22");
    }
}
