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

use crate::dlt_ft::{FtFile, FtIndexer, FtStreamer};
use dlt_core::filtering::DltFilterConfig;
use parsers::dlt::DltParser;
use sources::{producer::MessageProducer, raw::binary::BinaryByteSource};
use std::{fs::File, io::BufReader, path::PathBuf};
use tokio_util::sync::CancellationToken;

pub async fn scan_dlt_ft(
    input: File,
    filter: Option<DltFilterConfig>,
    with_storage_header: bool,
    cancel: CancellationToken,
) -> Option<Vec<FtFile>> {
    let reader = BufReader::new(&input);
    let source = BinaryByteSource::new(reader);
    let parser = DltParser::new(filter.map(|f| f.into()), None, with_storage_header);
    let mut producer = MessageProducer::new(parser, source, None);
    let indexer = FtIndexer::new();
    indexer.index_from_stream(producer.as_stream(), cancel).await
}

pub async fn extract_dlt_ft(
    input: File,
    output: PathBuf,
    files: Option<Vec<&FtFile>>,
    filter: Option<DltFilterConfig>,
    with_storage_header: bool,
    cancel: CancellationToken,
) -> Option<usize> {
    let reader = BufReader::new(&input);
    let source = BinaryByteSource::new(reader);
    let parser = DltParser::new(filter.map(|f| f.into()), None, with_storage_header);
    let mut producer = MessageProducer::new(parser, source, None);
    let mut streamer = FtStreamer::new(output);
    let result = streamer.extract_from_stream(producer.as_stream(), files, cancel).await;
    if streamer.is_complete() {
        return Some(result);
    }

    None
}
