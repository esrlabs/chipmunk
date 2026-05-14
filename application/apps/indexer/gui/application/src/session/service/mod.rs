use std::{
    fs,
    ops::ControlFlow,
    path::{Path, PathBuf},
    sync::Arc,
};

use image::ImageError;
use itertools::Itertools;
use tokio::{select, sync::mpsc, task};
use uuid::Uuid;

use processor::grabber::LineRange;
use session_core::session::Session;
use stypes::{CallbackEvent, ComputationError, ObserveOptions, ObserveOrigin, Transport};

mod export;
mod tracker;

use super::{command::SessionCommand, communication::ServiceHandle, error::SessionError};
use crate::{
    common::time::unix_timestamp_now,
    host::{
        message::HostMessage,
        notification::AppNotification,
        service::file::get_file_format,
        ui::{
            session_setup::state::{
                SessionSetupState,
                parsers::ParserConfig,
                sources::{ByteSourceConfig, StreamConfig},
            },
            storage::{RecentSessionRegistration, RecentSessionSource, RecentSessionStateSnapshot},
        },
    },
    session::{
        InitSessionError, RecentSessionRuntimeInit, RecentSessionTrackingInit, SessionUiInit,
        SpawnedRecentSession, SpawnedSession,
        command::AttachSource,
        communication::{self, ServiceSenders, SharedSenders},
        message::{BookmarkUpdate, SessionMessage},
        types::{
            ObserveOperation, OperationPhase,
            attachment::{PreviewContent, PreviewKind, PreviewRequest},
        },
        ui::{SessionInfo, chart::ChartBar, definitions::schema::LogSchemaSpec},
    },
};

use self::tracker::OperationTracker;

/// Async backend coordinator for one live session tab.
#[derive(Debug)]
pub struct SessionService {
    /// Commands received from the session UI.
    cmd_rx: mpsc::Receiver<SessionCommand>,
    /// Channels used to publish session, host, and notification messages.
    senders: ServiceSenders,
    /// Core backend session API.
    session: Session,
    /// Backend callback stream for this session.
    callback_rx: mpsc::UnboundedReceiver<CallbackEvent>,
    /// Follow-up state for operations completed through backend callbacks.
    tracker: OperationTracker,
    /// Temp sources owned and cleaned up when this service closes.
    owned_temp_sources: Vec<PathBuf>,
}

/// Inputs required to start one running session service.
#[derive(Debug)]
struct SessionStartup {
    /// Channels shared with the host and UI layers.
    shared_senders: SharedSenders,
    /// Backend session instance to drive.
    session: Session,
    /// Backend callback stream paired with `session`.
    callback_rx: mpsc::UnboundedReceiver<CallbackEvent>,
    /// Initial observe options for the primary source.
    options: ObserveOptions,
    /// Schema data used to render log rows.
    schema_spec: LogSchemaSpec,
    /// Extra sources observed during startup with the same parser.
    additional_sources: Vec<ObserveOrigin>,
    /// Optional UI state restored after session creation.
    restore_state: Option<RecentSessionStateSnapshot>,
    /// Temp sources owned and cleaned up by this service.
    owned_temp_sources: Vec<PathBuf>,
    /// Whether this session participates in recent-session storage.
    recent_session_policy: RecentSessionPolicy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RecentSessionPolicy {
    Register,
    Skip,
}

impl SessionService {
    /// Spawns the session service and returns the UI/session startup payload.
    ///
    /// * `shared_senders`: Senders to communicate with host UI.
    /// * `options`: defines the primary source.
    /// * `schema_spec`: Schema data used to render log rows.
    /// * `additional_sources`: Additional sources to be attached to session during startup.
    /// * `restore_state`: State to be restored once session is loaded.
    pub async fn spawn(
        shared_senders: SharedSenders,
        options: ObserveOptions,
        schema_spec: LogSchemaSpec,
        additional_sources: Vec<ObserveOrigin>,
        restore_state: Option<RecentSessionStateSnapshot>,
    ) -> Result<SpawnedSession, InitSessionError> {
        let session_id = Uuid::new_v4();
        let (session, callback_rx) = Session::new(session_id).await?;

        let startup = SessionStartup::new(
            shared_senders,
            session,
            callback_rx,
            options,
            schema_spec,
            additional_sources,
        )
        .with_restore_state(restore_state);

        Self::start(startup)
    }

    fn start(startup: SessionStartup) -> Result<SpawnedSession, InitSessionError> {
        let SessionStartup {
            shared_senders,
            session,
            callback_rx,
            options,
            schema_spec,
            additional_sources,
            restore_state,
            owned_temp_sources,
            recent_session_policy,
        } = startup;

        let session_id = session.get_uuid();
        let (ui_handle, service_handle) = communication::init(shared_senders);

        let session_info = SessionInfo::from_observe_options(session_id, &options);
        let mut recent_sources = RecentSessionSource::from_observe_origin(options.origin.clone());
        let parser = options.parser.clone();

        let observe_id = Uuid::new_v4();
        let observe_op = ObserveOperation::new(observe_id, options.origin.clone());
        session.observe(observe_id, options)?;

        // Attach additional sources.
        let mut startup_observe_ops = Vec::with_capacity(additional_sources.len());
        for origin in additional_sources {
            recent_sources.extend(RecentSessionSource::from_observe_origin(origin.clone()));

            let observe_id = Uuid::new_v4();
            let observe_op = ObserveOperation::new(observe_id, origin.clone());
            session.observe(
                observe_id,
                ObserveOptions {
                    origin,
                    parser: parser.clone(),
                },
            )?;
            startup_observe_ops.push(observe_op);
        }

        // Build registration to track normal sessions in recent-session storage.
        let recent_registration = match recent_session_policy {
            RecentSessionPolicy::Register => Some(RecentSessionRegistration::new(
                unix_timestamp_now(),
                recent_sources,
                parser,
            )),
            RecentSessionPolicy::Skip => None,
        };
        let recent_tracking =
            recent_registration
                .as_ref()
                .map(|registration| RecentSessionTrackingInit {
                    source_key: Arc::clone(&registration.source_key),
                    supports_bookmarks: registration.supports_bookmarks(),
                });

        let ServiceHandle { cmd_rx, senders } = service_handle;

        let service = Self {
            cmd_rx,
            senders,
            session,
            callback_rx,
            tracker: OperationTracker::default(),
            owned_temp_sources,
        };

        tokio::spawn(async move {
            service.run().await;
        });

        let ui_init = SessionUiInit {
            session_info,
            schema_spec,
            recent_runtime: RecentSessionRuntimeInit {
                tracking: recent_tracking,
                additional_observe_ops: startup_observe_ops,
            },
            communication: ui_handle,
            observe_op,
        };

        Ok(SpawnedSession {
            ui_init,
            recent: SpawnedRecentSession {
                registration: recent_registration,
                restore_state,
            },
        })
    }

    #[inline]
    pub fn session_id(&self) -> Uuid {
        self.session.get_uuid()
    }

    async fn run(mut self) {
        log::trace!("Start Session Service {}", self.session_id());

        loop {
            select! {
                Some(cmd) = self.cmd_rx.recv() => {
                    match self.handle_command(cmd).await {
                        Ok(ControlFlow::Break(())) => break,
                        Ok(ControlFlow::Continue(())) => {},
                        Err(error) => {
                            log::error!("Error while handling session commands: {error:?}");
                            self.send_error(error).await;
                        }
                    }
                },
                // Callback receiver won't be dropped when session is dropped.
                Some(event) = self.callback_rx.recv() => {
                    if let Err(error)= self.handle_callbacks(event).await {
                        log::error!("Error while handling session callback event: {error:?}");
                        self.send_error(error).await;
                    }
                }
                else => { break; }
            }
        }

        log::trace!("Session Service {} has been dropped", self.session_id());
    }

    async fn send_error(&self, error: SessionError) {
        let notifi = AppNotification::SessionError {
            session_id: self.session_id(),
            error,
        };

        self.senders.send_notification(notifi).await;
    }

    async fn handle_command(
        &mut self,
        cmd: SessionCommand,
    ) -> Result<ControlFlow<(), ()>, SessionError> {
        match cmd {
            SessionCommand::GrabLinesBlocking { range, sender } => {
                let elements = self
                    .session
                    .grab(range)
                    .await
                    .map(|e| e.0)
                    .map_err(SessionError::from);

                if sender.send(elements).is_err() {
                    log::debug!("Grabbed lines receiver dropped before receiving the results.");
                }
            }
            SessionCommand::GrabIndexedLinesBlocking { range, sender } => {
                let elements = self
                    .session
                    .grab_indexed(range.clone())
                    .await
                    .map(|e| e.0)
                    .map_err(SessionError::from);

                if sender.send(elements).is_err() {
                    log::debug!(
                        "Grabbed indexed lines receiver dropped before receiving the results."
                    );
                }
            }
            SessionCommand::ApplySearchFilter {
                operation_id,
                filters,
            } => {
                self.session.apply_search_filters(operation_id, filters)?;
            }
            SessionCommand::DropSearch { operation_id } => {
                if let Some(filter_op) = operation_id {
                    self.session.abort(Uuid::new_v4(), filter_op)?;
                }
                self.session.drop_search().await?;
            }
            SessionCommand::ApplySearchValuesFilter {
                operation_id,
                filters,
            } => {
                self.session
                    .apply_search_values_filters(operation_id, filters)?;
            }
            SessionCommand::DropSearchValues { operation_id } => {
                if let Some(values_op) = operation_id {
                    self.session.abort(Uuid::new_v4(), values_op)?;
                }
                self.session
                    .state
                    .drop_search_values()
                    .await
                    .map_err(SessionError::NativeError)?;
            }
            SessionCommand::GetNearestPosition(position) => {
                let nearest = self
                    .session
                    .state
                    .get_nearest_position(position)
                    .await
                    .map_err(SessionError::NativeError)
                    .map(|n| n.0);

                log::trace!(
                    "Nearest session value for session: {}: {nearest:?}",
                    self.session_id()
                );

                self.senders
                    .send_session_msg(SessionMessage::NearestPosition(nearest))
                    .await;
            }
            SessionCommand::GetIndexedNeighbor { anchor, direction } => {
                if let Some(row) = self
                    .session
                    .state
                    .get_indexed_neighbor(anchor, direction)
                    .await
                    .map_err(SessionError::NativeError)?
                {
                    self.senders
                        .send_session_msg(SessionMessage::IndexedNeighbor(row))
                        .await;
                }
            }
            SessionCommand::GetSelectedLog(pos) => {
                let rng = LineRange::from(pos..=pos);

                let selected_log = self
                    .session
                    .grab(rng)
                    .await
                    .and_then(|items| {
                        items.0.into_iter().next().ok_or_else(|| {
                            ComputationError::Process(String::from(
                                "Selected Item couldn't be fetched",
                            ))
                        })
                    })
                    .map_err(SessionError::from);

                self.senders
                    .send_session_msg(SessionMessage::SelectedLog(selected_log))
                    .await;
            }
            SessionCommand::PreviewAttachment(request) => {
                self.preview_attachment(request).await;
            }
            SessionCommand::AddBookmarks(rows) => {
                self.add_bookmarks(rows).await?;
            }
            SessionCommand::RemoveBookmark(row) => {
                self.session.remove_bookmark(row).await?;
                let bookmark = vec![BookmarkUpdate {
                    row,
                    is_bookmarked: false,
                }];
                self.senders
                    .send_session_msg(SessionMessage::BookmarkUpdated(bookmark))
                    .await;
            }
            SessionCommand::GetChartHistogram { dataset_len, range } => {
                let map = self
                    .session
                    .state
                    .get_scaled_map(dataset_len, range.map(|rng| (*rng.start(), *rng.end())))
                    .await
                    .map(|m| {
                        m.into_iter()
                            .map(|bars| {
                                bars.into_iter()
                                    .map(|(idx, count)| ChartBar::new(idx, count))
                                    .collect_vec()
                            })
                            .collect_vec()
                    })
                    .map_err(SessionError::NativeError);

                self.senders
                    .send_session_msg(SessionMessage::ChartHistogram(map))
                    .await;
            }
            SessionCommand::GetChartLinePlots { dataset_len, range } => {
                let values = self
                    .session
                    .state
                    .get_search_values(range, dataset_len)
                    .await
                    .map(|v| {
                        v.into_iter()
                            .map(|item| {
                                (
                                    item.0,
                                    item.1.into_iter().map(stypes::Point::from).collect_vec(),
                                )
                            })
                            .collect_vec()
                    })
                    .map_err(SessionError::NativeError);

                self.senders
                    .send_session_msg(SessionMessage::ChartLinePlots(values))
                    .await;
            }
            SessionCommand::AttachSource { source } => {
                let executed = self
                    .session
                    .state
                    .get_executed_holder()
                    .await
                    .map_err(SessionError::NativeError)?;

                let Some(parser) = executed.executed.first().map(|opt| opt.parser.to_owned())
                else {
                    if cfg!(debug_assertions) {
                        panic!("No executed operatoins");
                    }
                    return Ok(ControlFlow::Continue(()));
                };

                let origin = match source {
                    AttachSource::Files(paths) => {
                        let files = paths
                            .into_iter()
                            .map(|path| {
                                (
                                    Uuid::new_v4().to_string(),
                                    get_file_format(&path).unwrap_or(stypes::FileFormat::Text),
                                    path,
                                )
                            })
                            .collect_vec();
                        ObserveOrigin::Concat(files)
                    }
                    AttachSource::Stream(config) => {
                        let id = Uuid::new_v4().to_string();
                        let transport = match *config {
                            StreamConfig::Process(process) => Transport::Process(process.into()),
                            StreamConfig::Tcp(tcp) => Transport::TCP(tcp.into()),
                            StreamConfig::Udp(udp) => Transport::UDP(udp.into()),
                            StreamConfig::Serial(serial) => Transport::Serial(serial.into()),
                        };

                        ObserveOrigin::Stream(id, transport)
                    }
                };
                let observe_id = Uuid::new_v4();
                let observe_op = ObserveOperation::new(observe_id, origin.clone());

                self.session
                    .observe(observe_id, ObserveOptions { origin, parser })?;

                self.senders
                    .send_session_msg(SessionMessage::SourceAdded {
                        observe_op: Box::new(observe_op),
                    })
                    .await;
            }
            SessionCommand::StartSessionWithSource { source_uuid } => {
                let observed = self
                    .session
                    .state
                    .get_executed_holder()
                    .await
                    .map_err(SessionError::NativeError)?
                    .executed;

                for options in observed {
                    let source = match &options.origin {
                        ObserveOrigin::File(uuid, file_format, path_buf) => (uuid == &source_uuid)
                            .then(|| {
                                ByteSourceConfig::from_file(path_buf.to_owned(), *file_format)
                            }),
                        ObserveOrigin::Concat(items) => items
                            .iter()
                            .find(|(uuid, _, _)| uuid == &source_uuid)
                            .map(|(_, format, path)| {
                                ByteSourceConfig::from_file(path.to_owned(), *format)
                            }),
                        ObserveOrigin::Stream(uuid, transport) => (uuid == &source_uuid)
                            .then(|| ByteSourceConfig::from_transport(transport)),
                    };

                    let Some(source) = source else {
                        continue;
                    };

                    let parser = ParserConfig::from_observe_options(&options);

                    let session_setup = SessionSetupState::new(Uuid::new_v4(), source, parser);

                    self.senders
                        .send_host_message(HostMessage::SessionSetupOpened(Box::new(session_setup)))
                        .await;
                    return Ok(ControlFlow::Continue(()));
                }

                return Err(ComputationError::SessionCreatingFail.into());
            }
            SessionCommand::ExportRaw {
                operation_id,
                destination,
                target,
            } => {
                if let Err(error) = self
                    .handle_raw_export(operation_id, destination, target)
                    .await
                {
                    self.send_operation_failed(operation_id).await;
                    return Err(error);
                }
            }
            SessionCommand::ExportText {
                operation_id,
                destination,
                target,
                options,
            } => {
                if let Err(error) = self
                    .handle_text_export(operation_id, destination, target, *options)
                    .await
                {
                    self.send_operation_failed(operation_id).await;
                    return Err(error);
                }
            }
            SessionCommand::OpenSearchResultsAsNewTab {
                operation_id,
                restore_state,
            } => {
                if let Err(error) = self
                    .open_search_results_tab(operation_id, restore_state)
                    .await
                {
                    self.send_operation_failed(operation_id).await;
                    return Err(error);
                }
            }
            SessionCommand::CancelOperation { id } => {
                self.session.abort(Uuid::new_v4(), id)?;
            }
            SessionCommand::CloseSession => {
                // Session UI can be already dropped at this point, therefore
                // we don't need to send errors to UI in this case.

                if let Err(err) = self.session.stop(Uuid::new_v4()).await {
                    log::error!("Stopping session failed. {err:?}");
                }

                return Ok(ControlFlow::Break(()));
            }
        }

        Ok(ControlFlow::Continue(()))
    }

    async fn send_operation_failed(&self, operation_id: Uuid) {
        self.senders
            .send_session_msg(SessionMessage::OperationUpdated {
                operation_id,
                phase: OperationPhase::Failed,
            })
            .await;
    }

    async fn send_operation_skipped(&self, operation_id: Uuid) {
        self.senders
            .send_session_msg(SessionMessage::OperationUpdated {
                operation_id,
                phase: OperationPhase::Skipped,
            })
            .await;
    }

    async fn preview_attachment(&self, request: PreviewRequest) {
        let attachment_id = request.attachment_id;
        let target = request.target;
        let preview = self.load_preview(request).await;

        self.senders
            .send_session_msg(SessionMessage::AttachmentPreview {
                attachment_id,
                target,
                preview,
            })
            .await;
    }

    async fn load_preview(&self, request: PreviewRequest) -> Result<PreviewContent, SessionError> {
        let PreviewRequest {
            attachment_id,
            filepath,
            kind,
            target: _,
        } = request;

        match kind {
            PreviewKind::Text => {
                let content = tokio::fs::read_to_string(&filepath)
                    .await
                    .map_err(|error| ComputationError::IoOperation(error.to_string()))?;
                Ok(PreviewContent::Text(content))
            }
            PreviewKind::Image => {
                let color_image = task::spawn_blocking(move || decode_image(&filepath))
                    .await
                    .map_err(|error| ComputationError::Decoding(error.to_string()))?
                    .map_err(|error| ComputationError::Decoding(error.to_string()))?;
                let texture = self.senders.egui_ctx().load_texture(
                    format!("attachment-preview-{attachment_id}"),
                    color_image,
                    egui::TextureOptions::LINEAR,
                );
                Ok(PreviewContent::Image(texture))
            }
            PreviewKind::Unsupported => Err(ComputationError::OperationNotSupported(
                "attachment preview".to_string(),
            )
            .into()),
        }
    }

    async fn add_bookmarks(&mut self, rows: Vec<u64>) -> Result<(), SessionError> {
        let mut added = Vec::new();
        let mut errors = Vec::new();

        for row in rows {
            match self.session.add_bookmark(row).await {
                Ok(()) => added.push(BookmarkUpdate {
                    row,
                    is_bookmarked: true,
                }),
                Err(error) => errors.push((row, error)),
            }
        }

        if !added.is_empty() {
            self.senders
                .send_session_msg(SessionMessage::BookmarkUpdated(added))
                .await;
        }

        match errors.len() {
            0 => Ok(()),
            1 => Err(errors.pop().expect("one error must exist").1.into()),
            _ => {
                let details = errors
                    .into_iter()
                    .map(|(row, error)| format!("- row {row}: {error}"))
                    .join("; ");
                Err(
                    ComputationError::Process(format!("Failed to add bookmarks:\n{details}"))
                        .into(),
                )
            }
        }
    }

    async fn handle_callbacks(&mut self, event: CallbackEvent) -> Result<(), SessionError> {
        log::trace!(
            "Received callback. Session: {}. Event: {}",
            self.session_id(),
            event
        );
        match event {
            CallbackEvent::StreamUpdated(logs_count) => {
                self.senders
                    .send_session_msg(SessionMessage::LogsCount(logs_count))
                    .await;
            }
            CallbackEvent::SearchUpdated { found, stat: _ } => {
                self.senders
                    .send_session_msg(SessionMessage::SearchResultCountUpdated { count: found })
                    .await;
            }
            CallbackEvent::IndexedMapUpdated { len } => {
                self.senders
                    .send_session_msg(SessionMessage::IndexedCountUpdated { count: len })
                    .await;
            }
            CallbackEvent::SearchMapUpdated(filter_matches) => match filter_matches {
                Some(list) => {
                    self.senders
                        .send_session_msg(SessionMessage::SearchResults(list.0))
                        .await;
                }
                None => {
                    self.senders
                        .send_session_msg(SessionMessage::SearchResultsCleared)
                        .await;
                }
            },
            CallbackEvent::SearchValuesUpdated(values_matches) => {
                self.senders
                    .send_session_msg(SessionMessage::ChartSearchValues(values_matches))
                    .await;
            }
            CallbackEvent::OperationError { uuid, error } => {
                if self
                    .tracker
                    .search_results_tab
                    .as_ref()
                    .is_some_and(|operation| operation.operation_id == uuid)
                    && let Some(operation) = self.tracker.search_results_tab.take()
                {
                    cleanup_temp_source(&operation.destination);
                }

                // Stop running operation on errors besides sending the notification.
                self.senders
                    .send_session_msg(SessionMessage::OperationUpdated {
                        operation_id: uuid,
                        phase: OperationPhase::Failed,
                    })
                    .await;
                self.send_error(SessionError::NativeError(error)).await;
            }
            CallbackEvent::OperationStarted(uuid) => {
                self.senders
                    .send_session_msg(SessionMessage::OperationUpdated {
                        operation_id: uuid,
                        phase: OperationPhase::Initializing,
                    })
                    .await;
            }
            CallbackEvent::OperationProcessing(uuid) => {
                self.senders
                    .send_session_msg(SessionMessage::OperationUpdated {
                        operation_id: uuid,
                        phase: OperationPhase::Processing,
                    })
                    .await;
            }
            CallbackEvent::OperationDone(done) => {
                if let Err(error) = self.finish_results_tab(done.uuid).await {
                    self.senders
                        .send_session_msg(SessionMessage::OperationUpdated {
                            operation_id: done.uuid,
                            phase: OperationPhase::Failed,
                        })
                        .await;
                    return Err(error);
                }

                self.senders
                    .send_session_msg(SessionMessage::OperationUpdated {
                        operation_id: done.uuid,
                        phase: OperationPhase::Success,
                    })
                    .await;
            }
            CallbackEvent::FileRead => {
                self.senders
                    .send_session_msg(SessionMessage::FileReadCompleted)
                    .await;
            }
            CallbackEvent::AttachmentsUpdated { attachment, len } => {
                self.senders
                    .send_session_msg(SessionMessage::AttachmentsUpdated { attachment, len })
                    .await;
            }
            event => {
                println!("************** DEBUG: Received unhandled callback: {event:?}");
                log::warn!("Unhandled callback: {event}");
            }
        }

        Ok(())
    }
}

fn cleanup_temp_source(path: &Path) {
    match fs::remove_file(path) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => log::warn!(
            "Failed to remove temp search-results source {}: {error}",
            path.display()
        ),
    }
}

impl Drop for SessionService {
    fn drop(&mut self) {
        for path in self.owned_temp_sources.drain(..) {
            cleanup_temp_source(&path);
        }

        if let Some(operation) = self.tracker.search_results_tab.take() {
            cleanup_temp_source(&operation.destination);
        }
    }
}

impl SessionStartup {
    /// Creates startup inputs with no restore state or owned temp sources.
    fn new(
        shared_senders: SharedSenders,
        session: Session,
        callback_rx: mpsc::UnboundedReceiver<CallbackEvent>,
        options: ObserveOptions,
        schema_spec: LogSchemaSpec,
        additional_sources: Vec<ObserveOrigin>,
    ) -> Self {
        Self {
            shared_senders,
            session,
            callback_rx,
            options,
            schema_spec,
            additional_sources,
            restore_state: None,
            owned_temp_sources: Vec::new(),
            recent_session_policy: RecentSessionPolicy::Register,
        }
    }

    /// Adds optional restore state to apply after UI creation.
    fn with_restore_state(mut self, restore_state: Option<RecentSessionStateSnapshot>) -> Self {
        self.restore_state = restore_state;
        self
    }

    /// Transfers ownership of one generated temp source to the service.
    fn with_temp_source(mut self, path: PathBuf) -> Self {
        self.owned_temp_sources.push(path);
        self
    }

    /// Sets whether the session participates in recent-session storage.
    ///
    /// Recent-session registration is enabled by default.
    fn with_recent_session(mut self, enabled: bool) -> Self {
        self.recent_session_policy = if enabled {
            RecentSessionPolicy::Register
        } else {
            RecentSessionPolicy::Skip
        };
        self
    }
}

fn decode_image(path: &Path) -> Result<egui::ColorImage, ImageError> {
    let image = image::ImageReader::open(path)?.decode()?;
    let size = [image.width() as _, image.height() as _];
    let image_buffer = image.to_rgba8();
    let pixels = image_buffer.as_flat_samples();

    Ok(egui::ColorImage::from_rgba_unmultiplied(
        size,
        pixels.as_slice(),
    ))
}
