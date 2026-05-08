use std::{ops::RangeInclusive, path::PathBuf};

use std::sync::mpsc::Sender;

use processor::{grabber::LineRange, search::filter::SearchFilter};
use session_core::state::IndexedNavigation;
use stypes::GrabbedElement;
use uuid::Uuid;

use crate::host::ui::{
    session_setup::state::sources::StreamConfig, storage::RecentSessionStateSnapshot,
};
use crate::session::{error::SessionError, types::attachment};

/// Represents session specific commands to be sent from UI to session service.
///
/// # Note
///
/// These commands will be used in asynchronous context where UI wouldn't block
/// while they are running.
#[derive(Debug)]
pub enum SessionCommand {
    /// Apply the provided search filters.
    ApplySearchFilter {
        operation_id: Uuid,
        filters: Vec<SearchFilter>,
    },
    /// Cancel current search and clear results.
    /// If search operation is still processing then a search id will be provided
    /// to abort this operation.
    DropSearch { operation_id: Option<Uuid> },
    /// Apply the provided search value filters.
    ApplySearchValuesFilter {
        operation_id: Uuid,
        filters: Vec<String>,
    },
    /// Cancel current search values extraction and clear value results.
    /// If operation is still processing then an id will be provided to abort it.
    DropSearchValues { operation_id: Option<Uuid> },
    /// Request the nearest index in the search view for a given main-log index.
    GetNearestPosition(u64),

    /// Request the adjacent indexed row in the main logs table.
    GetIndexedNeighbor {
        /// Main-log row used as the exclusive starting point for navigation.
        /// When absent, navigation starts from the first indexed row.
        anchor: Option<u64>,
        /// Direction to search from the anchor, with wraparound at indexed-map boundaries.
        direction: IndexedNavigation,
    },

    /// Request details for a specific log line.
    GetSelectedLog(u64),

    /// Request preview content for one attachment.
    PreviewAttachment(attachment::PreviewRequest),

    /// Insert bookmarks for the provided stream rows.
    AddBookmarks(Vec<u64>),

    /// Remove a bookmark from the provided stream row.
    RemoveBookmark(u64),

    // --- Blocking Commands ---
    /// Synchronously fetches log lines for main table within the provided range.
    ///
    /// # Blocking
    ///
    /// Blocks UI rendering until the response is sent via `sender`.
    GrabLinesBlocking {
        range: LineRange,
        sender: Sender<Result<Vec<GrabbedElement>, SessionError>>,
    },
    /// Synchronously fetches specific lines by global index for search table.
    ///
    /// # Blocking
    ///
    /// Blocks UI rendering until the response is sent via `sender`.
    GrabIndexedLinesBlocking {
        range: RangeInclusive<u64>,
        sender: Sender<Result<Vec<GrabbedElement>, SessionError>>,
    },

    // --- Charts ---
    /// Request bar data for histograms.
    GetChartHistogram {
        dataset_len: u16,
        range: Option<RangeInclusive<u64>>,
    },
    /// Request point data for line plots.
    GetChartLinePlots {
        dataset_len: u16,
        range: Option<RangeInclusive<u64>>,
    },

    /// Attach the provided source to the running session.
    AttachSource { source: AttachSource },

    /// Starts a new session with the provided byte source, using the same
    /// configuration of the current session as basis
    StartSessionWithSource { source_uuid: String },

    /// Export raw source data for the selected target.
    ExportRaw {
        operation_id: Uuid,
        destination: PathBuf,
        target: ExportTarget,
    },

    /// Export rendered text logs for the selected target.
    ExportText {
        operation_id: Uuid,
        destination: PathBuf,
        target: ExportTarget,
        options: Box<TextExportOptions>,
    },

    /// Export current search results to a generated source and open it in a new session tab.
    OpenSearchResultsAsNewTab {
        operation_id: Uuid,
        restore_state: RecentSessionStateSnapshot,
    },

    /// Cancel the running operation with the given id.
    CancelOperation { id: Uuid },
    /// Gracefully terminate the session service.
    CloseSession,
}

#[derive(Debug)]
pub enum AttachSource {
    Files(Vec<PathBuf>),
    Stream(Box<StreamConfig>),
}

#[derive(Debug)]
pub enum ExportTarget {
    /// All stream rows in the main table.
    All,
    /// Current indexed lower-table rows.
    Indexed,
    /// Original stream row positions selected by the UI.
    Rows(Vec<u64>),
}

/// Options for rendered text export.
#[derive(Debug, Clone)]
pub enum TextExportOptions {
    /// Export full rendered rows without column filtering.
    FullRows,
    /// Export selected table columns joined by the provided delimiter.
    Table {
        columns: Vec<usize>,
        delimiter: String,
    },
}
