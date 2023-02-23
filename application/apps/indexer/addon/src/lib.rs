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

pub mod dlt_ft;

use crate::dlt_ft::{FileExtractor, FtScanner};
use dlt_core::filtering::DltFilterConfig;
use futures::pin_mut;
use parsers::{dlt::DltParser, Attachement, MessageStreamItem};
use sources::{producer::MessageProducer, raw::binary::BinaryByteSource};
use std::{
    fs::File,
    io::BufReader,
    path::{Path, PathBuf},
};
use tokio_util::sync::CancellationToken;

pub async fn scan_dlt_ft(
    input: PathBuf,
    filter: Option<DltFilterConfig>,
    with_storage_header: bool,
    cancel: CancellationToken,
) -> Result<Vec<Attachement>, String> {
    match File::open(input) {
        Ok(input) => {
            let reader = BufReader::new(&input);
            let source = BinaryByteSource::new(reader);
            let parser = DltParser::new(filter.map(|f| f.into()), None, with_storage_header);
            let mut producer = MessageProducer::new(parser, source, None);
            let stream = producer.as_stream();
            pin_mut!(stream);

            let mut scanner = FtScanner::new();
            let mut canceled = false;
            let mut offset = 0;

            loop {
                tokio::select! {
                    _ = cancel.cancelled() => {
                        debug!("scan canceled");
                        canceled = true;
                        break;
                    }
                    item = tokio_stream::StreamExt::next(&mut stream) => {
                        match item {
                            Some((consumed, item)) => {
                                if let MessageStreamItem::Item(item) = item {
                                    scanner.process(offset, &item.message);
                                }
                                offset += consumed;
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

            Ok(scanner.into())
        }
        Err(error) => Err(format!("failed to open file: {error}")),
    }
}

pub fn extract_dlt_ft(
    input: &Path,
    output: &Path,
    files: Vec<(Attachement, String)>,
    cancel: CancellationToken,
) -> Result<usize, String> {
    let mut result: usize = 0;

    let mut canceled = false;
    for (file, name) in files {
        if cancel.is_cancelled() {
            debug!("extract canceled");
            canceled = true;
            break;
        }
        match FileExtractor::extract(input, &output.join(name), file.chunks.clone()) {
            Ok(size) => {
                result += size;
            }
            Err(error) => {
                return Err(format!("failed after {result} bytes: {error}"));
            }
        }
    }

    if canceled {
        return Ok(0);
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dlt_ft::tests::TempDir;
    use std::path::Path;

    const DLT_FT_SAMPLE: &str = "tests/ft-sample.dlt";
    const DLT_FT_IDS: [usize; 3] = [129721424, 1005083951, 2406339683];

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
    async fn test_extract_dlt_ft2() {
        let input: PathBuf = Path::new(DLT_FT_SAMPLE).into();
        let output = TempDir::new();

        let cancel = CancellationToken::new();
        match scan_dlt_ft(input.clone(), None, true, cancel).await {
            Ok(files) => {
                let cancel = CancellationToken::new();
                let files_with_names =
                    std::iter::zip(files, (0..100).map(|i| format!("{i}.txt"))).collect();
                match extract_dlt_ft(&input, &output.dir, files_with_names, cancel) {
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

        output.assert_file("0.txt", "test1");
        output.assert_file("1.txt", "test22");
        output.assert_file("2.txt", "test333");
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
                let files_with_names =
                    std::iter::zip(files, (0..100).map(|i| format!("{i}"))).collect();
                match extract_dlt_ft(&input, &output.dir, files_with_names, cancel) {
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
                let files_with_names =
                    std::iter::zip(files, (0..100).map(|i| format!("output_test{i}.txt")))
                        .collect();
                match extract_dlt_ft(&input, &output.dir, files_with_names, cancel) {
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

        output.assert_file("output_test0.txt", "test22");
    }

    #[tokio::test]
    async fn test_extract_dlt_ft_with_index() {
        let input: PathBuf = Path::new(DLT_FT_SAMPLE).into();
        let output = TempDir::new();

        let cancel = CancellationToken::new();
        let dest_name = "test_output_file.txt".to_string();
        match scan_dlt_ft(input.clone(), None, true, cancel).await {
            Ok(files) => {
                let cancel = CancellationToken::new();
                match extract_dlt_ft(
                    &input,
                    &output.dir,
                    vec![(files.get(1).unwrap().clone(), dest_name.clone())],
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

        output.assert_file(&dest_name, "test22");
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
        let dest_name = "test_output_file.txt".to_string();
        match scan_dlt_ft(input.clone(), Some(filter), true, cancel).await {
            Ok(files) => {
                let cancel = CancellationToken::new();
                match extract_dlt_ft(
                    &input,
                    &output.dir,
                    vec![(files.get(0).unwrap().clone(), dest_name.clone())],
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

        output.assert_file(&dest_name, "test22");
    }
}
