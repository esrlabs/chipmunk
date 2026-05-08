//! Session export command handling and generated search-results tab flow.

use std::{ops::RangeInclusive, path::PathBuf};

use itertools::Itertools;
use uuid::Uuid;

use parsers::COLUMN_SEPARATOR;
use stypes::{ComputationError, FileFormat, ObserveOptions, ObserveOrigin, ParserType};

use super::{SessionService, SessionStartup, cleanup_temp_source};
use crate::{
    host::{
        common::parsers::ParserNames, message::HostMessage, ui::storage::RecentSessionStateSnapshot,
    },
    session::{
        InitSessionError,
        command::{ExportTarget, TextExportOptions},
        common::search_results_tab::SearchResultsTabMode,
        error::SessionError,
        ui::definitions::schema,
    },
};

/// In-flight generated search-results source waiting for export completion.
#[derive(Debug)]
pub struct SearchResultsTabOperation {
    /// Backend export operation id that must complete before opening the generated source.
    pub operation_id: Uuid,
    /// Temp file that receives exported search results and becomes the new session source.
    pub destination: PathBuf,
    /// Recent-session state to restore in the generated tab.
    pub restore_state: RecentSessionStateSnapshot,
    /// Export and reopen strategy resolved when the operation started.
    pub mode: SearchResultsTabMode,
}

impl SessionService {
    /// Starts a raw export for the requested target and reports skipped phases.
    pub async fn handle_raw_export(
        &self,
        operation_id: Uuid,
        destination: PathBuf,
        target: ExportTarget,
    ) -> Result<(), SessionError> {
        let ranges = self.export_ranges(target).await?;

        if ranges.is_empty() {
            self.send_operation_skipped(operation_id).await;
            return Ok(());
        }

        if let Err(error) = self.session.export_raw(operation_id, destination, ranges) {
            return Err(error.into());
        }

        Ok(())
    }

    /// Starts a rendered text export for the requested target and reports skipped phases.
    pub async fn handle_text_export(
        &self,
        operation_id: Uuid,
        destination: PathBuf,
        target: ExportTarget,
        options: TextExportOptions,
    ) -> Result<(), SessionError> {
        let ranges = self.export_ranges(target).await?;

        if ranges.is_empty() {
            self.send_operation_skipped(operation_id).await;
            return Ok(());
        }

        let (columns, splitter, delimiter) = match options {
            TextExportOptions::FullRows => (Vec::new(), None, None),
            TextExportOptions::Table { columns, delimiter } => {
                (columns, Some(COLUMN_SEPARATOR.to_owned()), Some(delimiter))
            }
        };

        if let Err(error) = self.session.export(
            operation_id,
            destination,
            ranges,
            columns,
            splitter,
            delimiter,
        ) {
            return Err(error.into());
        }

        Ok(())
    }

    /// Exports current indexed search results to a generated source for a new session tab.
    pub async fn open_search_results_tab(
        &mut self,
        operation_id: Uuid,
        restore_state: RecentSessionStateSnapshot,
    ) -> Result<(), SessionError> {
        // Only one generated-results export can be handed off at a time because the
        // callback path stores a single pending operation to open after export completes.
        if self.tracker.search_results_tab.is_some() {
            self.send_operation_skipped(operation_id).await;
            return Ok(());
        }

        // The new tab should contain exactly the rows currently available in the indexed
        // search-results map. Empty searches are reported as skipped instead of creating a file.
        let ranges = self.export_ranges(ExportTarget::Indexed).await?;

        if ranges.is_empty() {
            self.send_operation_skipped(operation_id).await;
            return Ok(());
        }

        // Recompute mode from executed options so UI label and service behavior use the
        // same rules without trusting a UI-provided mode.
        let executed = self
            .session
            .state
            .get_executed_holder()
            .await
            .map_err(SessionError::NativeError)?
            .executed;
        let mode = resolve_mode_from_executed(&executed);
        let destination = new_search_results_path(operation_id, mode)?;

        // Track ownership until the backend confirms export completion. On success the
        // generated path is transferred to the newly spawned session service.
        self.tracker.search_results_tab = Some(SearchResultsTabOperation {
            operation_id,
            destination: destination.clone(),
            restore_state,
            mode,
        });

        // Preserve raw bytes only when the export is a valid source for the target parser.
        // Other modes export rendered text, with DLT/SomeIP fallback formatted as table text.
        let result =
            match mode {
                SearchResultsTabMode::PreserveDltBinary => {
                    self.session.export_raw(operation_id, destination, ranges)
                }
                SearchResultsTabMode::PreserveText => {
                    self.session
                        .export(operation_id, destination, ranges, Vec::new(), None, None)
                }
                SearchResultsTabMode::Text => {
                    let parser = executed
                        .first()
                        .map(|options| ParserNames::from(&options.parser));
                    match parser {
                        Some(parser @ (ParserNames::Dlt | ParserNames::SomeIP)) => {
                            // In case of falling back to export DLT/SomeIP as text then use best effort
                            // separator to show them similar to columns as possible.
                            const FALLBACK_TEXT_DELIMITER: &str = " | ";
                            let schema = schema::from_parser(parser);
                            let columns = (0..schema.columns().len()).collect();

                            self.session.export(
                                operation_id,
                                destination,
                                ranges,
                                columns,
                                Some(COLUMN_SEPARATOR.to_owned()),
                                Some(FALLBACK_TEXT_DELIMITER.to_owned()),
                            )
                        }
                        Some(ParserNames::Text | ParserNames::Plugins) | None => self
                            .session
                            .export(operation_id, destination, ranges, Vec::new(), None, None),
                    }
                }
            };

        // Export start failures happen before OperationError callbacks, so cleanup the
        // generated path and clear tracking here.
        if let Err(error) = result {
            if let Some(operation) = self.tracker.search_results_tab.take() {
                cleanup_temp_source(&operation.destination);
            }
            return Err(error.into());
        }

        Ok(())
    }

    /// Opens the generated search-results source when its tracked export operation completes.
    pub async fn finish_results_tab(&mut self, operation_id: Uuid) -> Result<(), SessionError> {
        let is_tracked = self
            .tracker
            .search_results_tab
            .as_ref()
            .is_some_and(|operation| operation.operation_id == operation_id);
        if !is_tracked {
            return Ok(());
        }

        let operation = self
            .tracker
            .search_results_tab
            .take()
            .expect("tracked operation must exist");

        self.create_results_tab(operation).await
    }

    /// Resolves an export target into compact inclusive stream-row ranges.
    async fn export_ranges(
        &self,
        target: ExportTarget,
    ) -> Result<Vec<RangeInclusive<u64>>, SessionError> {
        match target {
            ExportTarget::All => {
                let len = self.session.get_stream_len().await?;
                if len == 0 {
                    Ok(Vec::new())
                } else {
                    Ok(vec![0..=(len as u64 - 1)])
                }
            }
            ExportTarget::Indexed => {
                let ranges = self
                    .session
                    .get_indexed_ranges()
                    .await?
                    .0
                    .into_iter()
                    .map(|range| range.start..=range.end)
                    .collect_vec();
                Ok(ranges)
            }
            ExportTarget::Rows(rows) => Ok(rows_to_ranges(rows)),
        }
    }

    /// Creates the new session from a generated search-results temp source.
    async fn create_results_tab(
        &mut self,
        operation: SearchResultsTabOperation,
    ) -> Result<(), SessionError> {
        let options = match self.search_results_observe_options(&operation).await {
            Ok(options) => options,
            Err(error) => {
                cleanup_temp_source(&operation.destination);
                return Err(error);
            }
        };

        let child_session_id = Uuid::new_v4();
        let (child_session, child_callback_rx) =
            match session_core::session::Session::new(child_session_id).await {
                Ok(session_parts) => session_parts,
                Err(error) => {
                    cleanup_temp_source(&operation.destination);
                    return Err(init_session_error_to_session_error(error.into()));
                }
            };
        let shared_senders = self.senders.get_shared_senders();
        let additional_sources = Vec::new();
        let restore_state = operation.restore_state;
        let temp_source = operation.destination.clone();
        let startup = SessionStartup::new(
            shared_senders,
            child_session,
            child_callback_rx,
            options,
            additional_sources,
        )
        .with_restore_state(Some(restore_state))
        .with_temp_source(temp_source)
        .with_recent_session(false);

        let session = Self::start(startup).map_err(init_session_error_to_session_error);

        let session = match session {
            Ok(session) => session,
            Err(error) => {
                cleanup_temp_source(&operation.destination);
                return Err(error);
            }
        };

        self.senders
            .send_host_message(HostMessage::SessionCreated {
                session: Box::new(session),
                session_setup_id: None,
            })
            .await;

        Ok(())
    }

    /// Builds observe options for reopening a generated search-results source.
    async fn search_results_observe_options(
        &self,
        operation: &SearchResultsTabOperation,
    ) -> Result<ObserveOptions, SessionError> {
        let parser = match operation.mode {
            SearchResultsTabMode::PreserveDltBinary => {
                let executed = self
                    .session
                    .state
                    .get_executed_holder()
                    .await
                    .map_err(SessionError::NativeError)?
                    .executed;
                match executed.first().map(|options| &options.parser) {
                    Some(ParserType::Dlt(settings)) => ParserType::Dlt(settings.clone()),
                    _ => {
                        debug_assert!(
                            false,
                            "preserved DLT search-results tab requires DLT parser"
                        );
                        ParserType::Text(())
                    }
                }
            }
            SearchResultsTabMode::PreserveText | SearchResultsTabMode::Text => ParserType::Text(()),
        };

        let file_format = match operation.mode {
            SearchResultsTabMode::PreserveDltBinary => FileFormat::Binary,
            SearchResultsTabMode::PreserveText | SearchResultsTabMode::Text => FileFormat::Text,
        };

        Ok(ObserveOptions {
            origin: ObserveOrigin::File(
                Uuid::new_v4().to_string(),
                file_format,
                operation.destination.clone(),
            ),
            parser,
        })
    }
}

/// Resolves the search-results tab mode from executed observe options.
fn resolve_mode_from_executed(executed: &[ObserveOptions]) -> SearchResultsTabMode {
    let Some(first) = executed.first() else {
        debug_assert!(
            false,
            "search-results tab mode requires executed observe options"
        );
        return SearchResultsTabMode::Text;
    };

    let parser = ParserNames::from(&first.parser);
    let origins = executed.iter().map(|options| &options.origin);

    SearchResultsTabMode::resolve_from(parser, origins)
}

/// Builds the temp destination path for a generated search-results source.
fn new_search_results_path(
    operation_id: Uuid,
    mode: SearchResultsTabMode,
) -> Result<PathBuf, SessionError> {
    let extension = match mode {
        SearchResultsTabMode::PreserveDltBinary => "dlt",
        SearchResultsTabMode::PreserveText | SearchResultsTabMode::Text => "txt",
    };

    let path = session_core::paths::get_streams_dir()
        .map_err(SessionError::NativeError)?
        .join(format!("search-results-{operation_id}.{extension}"));

    Ok(path)
}

/// Converts startup failures into the session error channel used by live sessions.
fn init_session_error_to_session_error(error: InitSessionError) -> SessionError {
    match error {
        InitSessionError::IO(error) => ComputationError::IoOperation(error.to_string()).into(),
        InitSessionError::Computation(error) => error.into(),
        InitSessionError::Other(error) => ComputationError::Process(error).into(),
    }
}

/// Converts selected stream row positions into compact inclusive ranges for raw export.
///
/// The UI snapshots selection from a hash set and does not own export range semantics, so
/// the service normalizes row order, removes duplicates, and compacts adjacent rows here.
fn rows_to_ranges(mut rows: Vec<u64>) -> Vec<RangeInclusive<u64>> {
    rows.sort_unstable();
    rows.dedup();

    let mut ranges = Vec::new();
    let mut rows = rows.into_iter();
    let Some(mut start) = rows.next() else {
        return ranges;
    };
    let mut end = start;

    for row in rows {
        if end.checked_add(1) == Some(row) {
            end = row;
        } else {
            ranges.push(start..=end);
            start = row;
            end = row;
        }
    }

    ranges.push(start..=end);
    ranges
}

#[cfg(test)]
mod tests {
    use std::ops::RangeInclusive;

    use super::rows_to_ranges;

    fn ranges(rows: Vec<u64>) -> Vec<RangeInclusive<u64>> {
        rows_to_ranges(rows)
    }

    #[test]
    fn empty_rows_make_no_ranges() {
        assert!(ranges(Vec::new()).is_empty());
    }

    #[test]
    fn single_row_makes_single_range() {
        assert_eq!(ranges(vec![7]), vec![7..=7]);
    }

    #[test]
    fn unsorted_rows_make_ordered_ranges() {
        assert_eq!(ranges(vec![5, 3, 4, 10]), vec![3..=5, 10..=10]);
    }

    #[test]
    fn duplicate_rows_are_deduped() {
        assert_eq!(ranges(vec![2, 2, 3, 5, 5]), vec![2..=3, 5..=5]);
    }

    #[test]
    fn gaps_make_multiple_ranges() {
        assert_eq!(ranges(vec![1, 2, 4, 7, 8]), vec![1..=2, 4..=4, 7..=8]);
    }
}
