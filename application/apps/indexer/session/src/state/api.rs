use crate::{
    events::NativeError,
    state::{
        indexes::controller::Mode as IndexesMode, observed::Observed, session_file::GrabbedElement,
        source_ids::SourceDefinition,
    },
    tracker::OperationTrackerAPI,
};
use processor::{
    grabber::LineRange,
    map::{FilterMatch, FiltersStats, NearestPosition, ScaledDistribution},
    search::searchers::{regular::RegularSearchHolder, values::ValueSearchHolder},
};
use sources::factory::ObserveOptions;
use std::{fmt::Display, ops::RangeInclusive, path::PathBuf};
use tokio::sync::{
    mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
    oneshot,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub enum Api {
    SetSessionFile((Option<PathBuf>, oneshot::Sender<Result<(), NativeError>>)),
    GetSessionFile(oneshot::Sender<Result<PathBuf, NativeError>>),
    WriteSessionFile((u8, String, oneshot::Sender<Result<(), NativeError>>)),
    FlushSessionFile(oneshot::Sender<Result<(), NativeError>>),
    UpdateSession((u8, oneshot::Sender<Result<bool, NativeError>>)),
    AddSource((String, oneshot::Sender<u8>)),
    GetSourcesDefinitions(oneshot::Sender<Vec<SourceDefinition>>),
    #[allow(clippy::large_enum_variant)]
    AddExecutedObserve((ObserveOptions, oneshot::Sender<()>)),
    GetExecutedHolder(oneshot::Sender<Observed>),
    IsRawExportAvailable(oneshot::Sender<bool>),
    ExportSession {
        out_path: PathBuf,
        ranges: Vec<std::ops::RangeInclusive<u64>>,
        cancel: CancellationToken,
        tx_response: oneshot::Sender<Result<bool, NativeError>>,
    },
    FileRead(oneshot::Sender<()>),
    Grab(
        (
            LineRange,
            oneshot::Sender<Result<Vec<GrabbedElement>, NativeError>>,
        ),
    ),
    GrabIndexed(
        (
            RangeInclusive<u64>,
            oneshot::Sender<Result<Vec<GrabbedElement>, NativeError>>,
        ),
    ),
    SetIndexingMode((IndexesMode, oneshot::Sender<Result<(), NativeError>>)),
    GetIndexedMapLen(oneshot::Sender<usize>),
    #[allow(clippy::type_complexity)]
    GetDistancesAroundIndex(
        (
            u64,
            oneshot::Sender<Result<(Option<u64>, Option<u64>), NativeError>>,
        ),
    ),
    AddBookmark((u64, oneshot::Sender<Result<(), NativeError>>)),
    SetBookmarks((Vec<u64>, oneshot::Sender<Result<(), NativeError>>)),
    RemoveBookmark((u64, oneshot::Sender<Result<(), NativeError>>)),
    ExpandBreadcrumbs {
        seporator: u64,
        offset: u64,
        above: bool,
        tx_response: oneshot::Sender<Result<(), NativeError>>,
    },
    GrabSearch(
        (
            LineRange,
            oneshot::Sender<Result<Vec<GrabbedElement>, NativeError>>,
        ),
    ),
    #[allow(clippy::type_complexity)]
    GrabRanges(
        (
            Vec<RangeInclusive<u64>>,
            oneshot::Sender<Result<Vec<GrabbedElement>, NativeError>>,
        ),
    ),
    GetStreamLen(oneshot::Sender<(u64, u64)>),
    GetSearchResultLen(oneshot::Sender<usize>),
    GetSearchHolder(
        (
            Uuid,
            oneshot::Sender<Result<RegularSearchHolder, NativeError>>,
        ),
    ),
    SetSearchHolder(
        (
            Option<RegularSearchHolder>,
            Uuid,
            oneshot::Sender<Result<(), NativeError>>,
        ),
    ),
    DropSearch(oneshot::Sender<bool>),
    GetNearestPosition((u64, oneshot::Sender<Option<NearestPosition>>)),
    GetScaledMap((u16, Option<(u64, u64)>, oneshot::Sender<ScaledDistribution>)),
    SetMatches(
        (
            Option<Vec<FilterMatch>>,
            Option<FiltersStats>,
            oneshot::Sender<()>,
        ),
    ),
    GetSearchValuesHolder(
        (
            Uuid,
            oneshot::Sender<Result<ValueSearchHolder, NativeError>>,
        ),
    ),
    SetSearchValuesHolder(
        (
            Option<ValueSearchHolder>,
            Uuid,
            oneshot::Sender<Result<(), NativeError>>,
        ),
    ),
    DropSearchValues(oneshot::Sender<bool>),
    CloseSession(oneshot::Sender<()>),
    SetDebugMode((bool, oneshot::Sender<()>)),
    NotifyCancelingOperation(Uuid),
    NotifyCanceledOperation(Uuid),
    Shutdown,
}

impl Display for Api {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Self::SetSessionFile(_) => "SetSessionFile",
                Self::GetSessionFile(_) => "GetSessionFile",
                Self::WriteSessionFile(_) => "WriteSessionFile",
                Self::FlushSessionFile(_) => "FlushSessionFile",
                Self::UpdateSession(_) => "UpdateSession",
                Self::AddSource(_) => "AddSource",
                Self::GetSourcesDefinitions(_) => "GetSourcesDefinitions",
                Self::AddExecutedObserve(_) => "AddExecutedObserve",
                Self::GetExecutedHolder(_) => "GetExecutedHolder",
                Self::IsRawExportAvailable(_) => "IsRawExportAvailable",
                Self::ExportSession { .. } => "ExportSession",
                Self::FileRead(_) => "FileRead",
                Self::Grab(_) => "Grab",
                Self::GetStreamLen(_) => "GetStreamLen",
                Self::GetSearchResultLen(_) => "GetSearchResultLen",
                Self::GetSearchHolder(_) => "GetSearchHolder",
                Self::SetSearchHolder(_) => "SetSearchHolder",
                Self::DropSearch(_) => "DropSearch",
                Self::GrabSearch(_) => "GrabSearch",
                Self::GrabIndexed(_) => "GrabIndexed",
                Self::SetIndexingMode(_) => "SetIndexingMode",
                Self::GetIndexedMapLen(_) => "GetIndexedMapLen",
                Self::GetDistancesAroundIndex(_) => "GetDistancesAroundIndex",
                Self::AddBookmark(_) => "AddBookmark",
                Self::SetBookmarks(_) => "SetBookmarks",
                Self::RemoveBookmark(_) => "RemoveBookmark",
                Self::ExpandBreadcrumbs { .. } => "ExpandBreadcrumbs",
                Self::GrabRanges(_) => "GrabRanges",
                Self::GetNearestPosition(_) => "GetNearestPosition",
                Self::GetScaledMap(_) => "GetScaledMap",
                Self::SetMatches(_) => "SetMatches",
                Self::GetSearchValuesHolder(_) => "GetSearchValuesHolder",
                Self::SetSearchValuesHolder(_) => "SetSearchValuesHolder",
                Self::DropSearchValues(_) => "DropSearchValues",
                Self::CloseSession(_) => "CloseSession",
                Self::SetDebugMode(_) => "SetDebugMode",
                Self::NotifyCancelingOperation(_) => "NotifyCancelingOperation",
                Self::NotifyCanceledOperation(_) => "NotifyCanceledOperation",
                Self::Shutdown => "Shutdown",
            }
        )
    }
}

#[derive(Clone, Debug)]
pub struct SessionStateAPI {
    tx_api: UnboundedSender<Api>,
    tracker: OperationTrackerAPI,
    closing_token: CancellationToken,
}

#[allow(clippy::type_complexity)]
impl SessionStateAPI {
    pub fn new(tracker: OperationTrackerAPI) -> (Self, UnboundedReceiver<Api>) {
        let (tx_api, rx_api): (UnboundedSender<Api>, UnboundedReceiver<Api>) = unbounded_channel();
        (
            SessionStateAPI {
                tx_api,
                closing_token: CancellationToken::new(),
                tracker,
            },
            rx_api,
        )
    }

    async fn exec_operation<T>(
        &self,
        api: Api,
        rx_response: oneshot::Receiver<T>,
    ) -> Result<T, NativeError> {
        let api_str = format!("{api}");
        self.tx_api.send(api).map_err(|e| {
            NativeError::channel(&format!("Failed to send to Api::{api_str}; error: {e}"))
        })?;
        rx_response.await.map_err(|_| {
            NativeError::channel(&format!("Failed to get response from Api::{api_str}"))
        })
    }

    pub async fn grab(&self, range: LineRange) -> Result<Vec<GrabbedElement>, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::Grab((range.clone(), tx)), rx)
            .await?
    }

    pub async fn grab_indexed(
        &self,
        range: RangeInclusive<u64>,
    ) -> Result<Vec<GrabbedElement>, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GrabIndexed((range, tx)), rx)
            .await?
    }

    pub async fn set_indexing_mode(&self, mode: IndexesMode) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetIndexingMode((mode, tx)), rx)
            .await?
    }

    pub async fn get_indexed_len(&self) -> Result<usize, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetIndexedMapLen(tx), rx).await
    }

    pub async fn get_around_indexes(
        &self,
        position: u64,
    ) -> Result<(Option<u64>, Option<u64>), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetDistancesAroundIndex((position, tx)), rx)
            .await?
    }

    pub async fn add_bookmark(&self, row: u64) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::AddBookmark((row, tx)), rx).await?
    }

    pub async fn set_bookmarks(&self, rows: Vec<u64>) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetBookmarks((rows, tx)), rx)
            .await?
    }

    pub async fn remove_bookmark(&self, row: u64) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::RemoveBookmark((row, tx)), rx)
            .await?
    }

    pub async fn expand_breadcrumbs(
        &self,
        seporator: u64,
        offset: u64,
        above: bool,
    ) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(
            Api::ExpandBreadcrumbs {
                seporator,
                offset,
                above,
                tx_response: tx,
            },
            rx,
        )
        .await?
    }

    pub async fn grab_search(&self, range: LineRange) -> Result<Vec<GrabbedElement>, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GrabSearch((range, tx)), rx)
            .await?
    }

    pub async fn grab_ranges(
        &self,
        ranges: Vec<RangeInclusive<u64>>,
    ) -> Result<Vec<GrabbedElement>, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GrabRanges((ranges, tx)), rx)
            .await?
    }

    pub async fn get_stream_len(&self) -> Result<(u64, u64), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetStreamLen(tx), rx).await
    }

    pub async fn get_search_result_len(&self) -> Result<usize, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetSearchResultLen(tx), rx).await
    }

    pub async fn get_nearest_position(
        &self,
        position: u64,
    ) -> Result<Option<NearestPosition>, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetNearestPosition((position, tx)), rx)
            .await
    }

    pub async fn get_scaled_map(
        &self,
        dataset_len: u16,
        range: Option<(u64, u64)>,
    ) -> Result<ScaledDistribution, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetScaledMap((dataset_len, range, tx)), rx)
            .await
    }

    pub async fn set_session_file(&self, filename: Option<PathBuf>) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetSessionFile((filename, tx)), rx)
            .await?
    }

    pub async fn get_session_file(&self) -> Result<PathBuf, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetSessionFile(tx), rx).await?
    }

    pub async fn write_session_file(&self, source_id: u8, msg: String) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::WriteSessionFile((source_id, msg, tx)), rx)
            .await?
    }

    pub async fn flush_session_file(&self) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::FlushSessionFile(tx), rx).await?
    }

    pub async fn update_session(&self, source_id: u8) -> Result<bool, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::UpdateSession((source_id, tx)), rx)
            .await?
    }

    pub async fn add_source(&self, uuid: &str) -> Result<u8, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::AddSource((uuid.to_owned(), tx)), rx)
            .await
    }

    pub async fn get_sources_definitions(&self) -> Result<Vec<SourceDefinition>, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetSourcesDefinitions(tx), rx)
            .await
    }

    pub async fn add_executed_observe(&self, options: ObserveOptions) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::AddExecutedObserve((options, tx)), rx)
            .await
    }

    pub async fn get_executed_holder(&self) -> Result<Observed, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetExecutedHolder(tx), rx).await
    }

    pub async fn is_raw_export_available(&self) -> Result<bool, NativeError> {
        let (tx_response, rx) = oneshot::channel();
        self.exec_operation(Api::IsRawExportAvailable(tx_response), rx)
            .await
    }

    pub async fn export_session(
        &self,
        out_path: PathBuf,
        ranges: Vec<std::ops::RangeInclusive<u64>>,
        cancel: CancellationToken,
    ) -> Result<bool, NativeError> {
        let (tx_response, rx) = oneshot::channel();
        self.exec_operation(
            Api::ExportSession {
                out_path,
                ranges,
                tx_response,
                cancel,
            },
            rx,
        )
        .await?
    }

    pub async fn file_read(&self) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::FileRead(tx), rx).await
    }

    pub async fn get_search_holder(&self, uuid: Uuid) -> Result<RegularSearchHolder, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetSearchHolder((uuid, tx)), rx)
            .await?
    }

    pub async fn set_search_holder(
        &self,
        holder: Option<RegularSearchHolder>,
        uuid: Uuid,
    ) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetSearchHolder((holder, uuid, tx)), rx)
            .await?
    }

    pub async fn drop_search(&self) -> Result<bool, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::DropSearch(tx), rx).await
    }

    pub async fn set_matches(
        &self,
        matches: Option<Vec<FilterMatch>>,
        stats: Option<FiltersStats>,
    ) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetMatches((matches, stats, tx)), rx)
            .await
    }

    pub async fn canceling_operation(&self, uuid: Uuid) -> Result<(), NativeError> {
        self.tx_api
            .send(Api::NotifyCancelingOperation(uuid))
            .map_err(|e| {
                NativeError::channel(&format!(
                    "fail to send to Api::NotifyCancelingOperation; error: {e}",
                ))
            })
    }

    pub async fn canceled_operation(&self, uuid: Uuid) -> Result<(), NativeError> {
        self.tx_api
            .send(Api::NotifyCanceledOperation(uuid))
            .map_err(|e| {
                NativeError::channel(&format!(
                    "Failed to send to Api::NotifyCanceledOperation; error: {e}",
                ))
            })
    }

    pub async fn get_search_values_holder(
        &self,
        uuid: Uuid,
    ) -> Result<ValueSearchHolder, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetSearchValuesHolder((uuid, tx)), rx)
            .await?
    }

    pub async fn set_search_values_holder(
        &self,
        holder: Option<ValueSearchHolder>,
        uuid: Uuid,
    ) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetSearchValuesHolder((holder, uuid, tx)), rx)
            .await?
    }

    pub async fn drop_search_values(&self) -> Result<bool, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::DropSearchValues(tx), rx).await
    }

    pub async fn close_session(&self) -> Result<(), NativeError> {
        self.closing_token.cancel();
        self.tracker.cancel_all().await?;
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::CloseSession(tx), rx).await
    }

    pub async fn set_debug(&self, debug: bool) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetDebugMode((debug, tx)), rx)
            .await
    }

    pub fn shutdown(&self) -> Result<(), NativeError> {
        self.tx_api.send(Api::Shutdown).map_err(|e| {
            NativeError::channel(&format!("fail to send to Api::Shutdown; error: {e}",))
        })
    }

    pub fn is_closing(&self) -> bool {
        self.closing_token.is_cancelled()
    }
}
