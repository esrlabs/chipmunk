use std::path::PathBuf;

use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;

use processor::search::searchers::{
    regular::{self, RegularSearchHolder},
    values::{OperationResults, ValueSearchHolder},
};

#[derive(Debug)]
pub enum SearchRequest {
    SearchRegular {
        rows: u64,
        bytes: u64,
        cancel: CancellationToken,
    },
    SearchValue {
        rows: u64,
        bytes: u64,
        cancel: CancellationToken,
    },
    GetSearchHolder {
        filename: PathBuf,
        sender: oneshot::Sender<Result<RegularSearchHolder, stypes::NativeError>>,
    },
    GetSearchValueHolder {
        filename: PathBuf,
        sender: oneshot::Sender<Result<ValueSearchHolder, stypes::NativeError>>,
    },
    SetSearchHolder {
        holder: Option<RegularSearchHolder>,
        tx_response: oneshot::Sender<Result<(), stypes::NativeError>>,
    },
    SetValueHolder {
        holder: Option<ValueSearchHolder>,
        tx_response: oneshot::Sender<Result<(), stypes::NativeError>>,
    },
    DropSearch {
        tx_result: oneshot::Sender<bool>,
    },
    DropSearchValue {
        tx_result: oneshot::Sender<bool>,
    },
}

#[derive(Debug)]
pub enum SearchResponse {
    SearchRegularResult(regular::SearchResults),
    SearchValueResult(OperationResults),
}
