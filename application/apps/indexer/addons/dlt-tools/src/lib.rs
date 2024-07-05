#![deny(unused_crate_dependencies)]
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
extern crate indexer_base;

#[macro_use]
extern crate log;

use dlt_core::filtering::DltFilterConfig;
use futures::pin_mut;
use parsers::{dlt::DltParser, Attachment, MessageStreamItem, ParseYield};
use sources::{binary::raw::BinaryByteSource, producer::MessageProducer};
use std::{
    fs::File,
    io::{BufReader, BufWriter, Write},
    path::{Path, PathBuf},
};
use tokio_util::sync::CancellationToken;

pub async fn scan_dlt_ft(
    input: PathBuf,
    filter: Option<DltFilterConfig>,
    with_storage_header: bool,
    cancel: CancellationToken,
) -> Result<Vec<Attachment>, String> {
    match File::open(input) {
        Ok(input) => {
            let reader = BufReader::new(&input);
            let source = BinaryByteSource::new(reader);
            let parser = DltParser::new(filter.map(|f| f.into()), None, None, with_storage_header);
            let mut producer = MessageProducer::new(parser, source, None);
            let stream = producer.as_stream();
            pin_mut!(stream);

            let mut canceled = false;

            let mut attachments = vec![];
            loop {
                tokio::select! {
                    _ = cancel.cancelled() => {
                        debug!("scan canceled");
                        canceled = true;
                        break;
                    }
                    items = tokio_stream::StreamExt::next(&mut stream) => {
                        match items {
                            Some(items) => {
                                for (_, item) in items {
                                if let MessageStreamItem::Item(ParseYield::MessageAndAttachment((_msg, attachment))) = item {
                                    attachments.push(attachment);
                                } else if let MessageStreamItem::Item(ParseYield::Attachment(attachment)) = item {
                                    attachments.push(attachment);
                                }
                                }
                            }
                            _ => {
                                break;
                            }
                        }
                    }
                }
            }

            if canceled {
                return Ok(Vec::new());
            }

            Ok(attachments)
        }
        Err(error) => Err(format!("failed to open file: {error}")),
    }
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
            File::create(&output.join(name)).map_err(|e| format!("Error opening file: {e}"))?,
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

    const DLT_FT_SAMPLE: &str = "../../../../../application/developing/resources/attachments.dlt";

    #[tokio::test]
    async fn test_scan_dlt_ft() {
        let input: PathBuf = Path::new(DLT_FT_SAMPLE).into();

        let cancel = CancellationToken::new();
        match scan_dlt_ft(input, None, true, cancel).await {
            Ok(files) => {
                assert_eq!(files.len(), 3);
                assert_eq!("test1.txt", files.get(0).unwrap().name);
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

        match scan_dlt_ft(input, None, true, cancel).await {
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

        let filter = DltFilterConfig {
            min_log_level: None,
            app_ids: None,
            ecu_ids: Some(vec!["ecu2".to_string()]),
            context_ids: None,
            app_id_count: 0,
            context_id_count: 0,
        };

        let cancel = CancellationToken::new();
        match scan_dlt_ft(input, Some(filter), true, cancel).await {
            Ok(files) => {
                assert_eq!(files.len(), 1);
                assert_eq!("test2.txt", files.get(0).unwrap().name);
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
        match scan_dlt_ft(input.clone(), None, true, cancel.clone()).await {
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
        match scan_dlt_ft(input.clone(), None, true, cancel).await {
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

        let filter = DltFilterConfig {
            min_log_level: None,
            app_ids: None,
            ecu_ids: Some(vec!["ecu2".to_string()]),
            context_ids: None,
            app_id_count: 0,
            context_id_count: 0,
        };

        let cancel = CancellationToken::new();
        match scan_dlt_ft(input.clone(), Some(filter), true, cancel).await {
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
        match scan_dlt_ft(input.clone(), None, true, cancel).await {
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

        let filter = DltFilterConfig {
            min_log_level: None,
            app_ids: None,
            ecu_ids: Some(vec!["ecu2".to_string()]),
            context_ids: None,
            app_id_count: 0,
            context_id_count: 0,
        };

        let cancel = CancellationToken::new();
        match scan_dlt_ft(input.clone(), Some(filter), true, cancel).await {
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
