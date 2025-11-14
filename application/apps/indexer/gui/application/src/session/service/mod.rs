use std::sync::Arc;

use processor::grabber::LineRange;
use tokio::{select, sync::mpsc};
use uuid::Uuid;

use session_core::session::Session;
use stypes::{CallbackEvent, ObserveOptions};

use super::{command::SessionCommand, communication::ServiceHandle, error::SessionError};
use crate::{
    host::{event::HostEvent, notification::AppNotification},
    session::{
        InitSessionError,
        command::SessionBlockingCommand,
        communication::{ServiceBlockCommuniaction, ServiceSenders},
        event::SessionEvent,
        info::SessionInfo,
    },
};
use operation_track::OperationTracker;

mod operation_track;

#[derive(Debug)]
pub struct SessionService {
    session_id: Uuid,
    cmd_rx: mpsc::Receiver<SessionCommand>,
    senders: ServiceSenders,
    session: Arc<Session>,
    ops_tracker: OperationTracker,
    callback_rx: mpsc::UnboundedReceiver<CallbackEvent>,
}

impl SessionService {
    /// Spawn session service returning the session ID.
    pub async fn spawn(
        communication: ServiceHandle,
        options: ObserveOptions,
    ) -> Result<SessionInfo, InitSessionError> {
        let session_id = Uuid::new_v4();
        let (session, callback_rx) = session_core::session::Session::new(session_id).await?;

        let session_info = SessionInfo::from_observe_options(session_id, &options);

        session.observe(Uuid::new_v4(), options)?;

        let ServiceHandle {
            cmd_rx,
            block_communication,
            senders,
        } = communication;

        let session = Arc::new(session);

        let service = Self {
            session_id,
            cmd_rx,
            senders,
            session: Arc::clone(&session),
            ops_tracker: OperationTracker::default(),
            callback_rx,
        };

        tokio::spawn(async move {
            service.run().await;
        });

        // We need to spawn a separate task to handle blocking commands because
        // those commands will be sent and should be handled in the same frame
        // rendering routine where it still has access to session state data.
        //
        // Mixing the blocking and asynchronous commands will lead to dead-locks
        // since the async command will request access to session state date while
        // it's reference is hold in the UI thread.
        tokio::task::spawn(async {
            Self::handle_blocking_cmds(session, block_communication).await;
        });

        Ok(session_info)
    }

    async fn run(mut self) {
        log::trace!("Start Session Service {}", self.session_id);

        loop {
            select! {
                Some(cmd) = self.cmd_rx.recv() => {
                    if let Err(error) = self.handle_command(cmd).await {
                        log::error!("Error while handling session commands: {error:?}");
                        self.send_error(error).await;
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

        log::trace!("Session Service {} has been dropped", self.session_id);

        //TODO AAZ: Keep this to make sure that session are dropped.
        println!(
            "****** DEBUG: Session Service {} has been dropped from async task",
            self.session_id
        );
    }

    async fn send_error(&self, error: SessionError) {
        let notifi = AppNotification::SessionError {
            session_id: self.session_id,
            error,
        };

        self.senders.send_notification(notifi).await;
    }

    async fn handle_command(&mut self, cmd: SessionCommand) -> Result<(), SessionError> {
        match cmd {
            SessionCommand::ApplySearchFilter(search_filters) => {
                let op_id = Uuid::new_v4();
                debug_assert!(
                    self.ops_tracker.filter_op.is_none(),
                    "filter must be dropped before applying new one"
                );
                self.ops_tracker.filter_op = Some(op_id);
                self.session.apply_search_filters(op_id, search_filters)?;

                self.senders.modify_state(|data| {
                    data.search.activate();
                    true
                });
            }
            SessionCommand::DropSearch => {
                if let Some(filter_op) = self.ops_tracker.filter_op.take() {
                    self.session.abort(Uuid::new_v4(), filter_op)?;
                }
                let res = self.session.drop_search().await;
                // Drop search from UI even if dropping the search in core has failed.
                self.senders.modify_state(|data| {
                    data.search.drop_search();
                    true
                });

                res?;
            }
            SessionCommand::GetNearestPosition(position) => {
                let nearest = self
                    .session
                    .state
                    .get_nearest_position(position)
                    .await
                    .map_err(SessionError::NativeError)?;

                log::trace!(
                    "Nearest session value for session: {}: {nearest:?}",
                    self.session_id
                );

                if let Some(nearest) = nearest.0 {
                    self.senders
                        .send_session_event(SessionEvent::NearestPosition(nearest))
                        .await;
                }
            }
            SessionCommand::SetSelectedLog(stearm_position) => {
                if let Some(pos) = stearm_position {
                    let rng = LineRange::from(pos..=pos);
                    match self.session.grab(rng).await {
                        Ok(elements) => {
                            self.senders.modify_state(|state| {
                                state.selected_log = elements.0.into_iter().next();
                                true
                            });
                        }
                        Err(err) => {
                            self.senders.modify_state(|state| {
                                if state.selected_log.is_some() {
                                    state.selected_log = None;
                                    return true;
                                }
                                false
                            });
                            return Err(err.into());
                        }
                    };
                } else {
                    self.senders.modify_state(|state| {
                        state.selected_log = None;
                        true
                    });
                }
            }
            SessionCommand::CloseSession => {
                for op_id in self.ops_tracker.get_all() {
                    self.session.abort(Uuid::new_v4(), op_id)?;
                }

                self.session.stop(Uuid::new_v4()).await?;

                self.senders
                    .send_host_event(HostEvent::CloseSession {
                        session_id: self.session_id,
                    })
                    .await;
            }
        }

        Ok(())
    }

    async fn handle_callbacks(&mut self, event: CallbackEvent) -> Result<(), SessionError> {
        println!("************** DEBUG SIMPLE: Received callback: {event}");

        log::trace!(
            "Received callback. Session: {}. Event: {}",
            self.session_id,
            event
        );
        match event {
            CallbackEvent::StreamUpdated(logs_count) => {
                self.senders.modify_state(|state| {
                    state.logs_count = logs_count;
                    true
                });
            }
            // TODO AAZ: Search callbacks seem to have duplications. Check
            // how they're used in master.
            //
            // CallbackEvent::SearchUpdated { found, stat } => {
            // }
            CallbackEvent::IndexedMapUpdated { len } => {
                self.senders.modify_state(|data| {
                    data.search.search_count = len;
                    true
                });
            }
            CallbackEvent::SearchMapUpdated(filter_matches) => {
                if let Some(list) = filter_matches {
                    // Long process ends when it deliver its initial results.
                    self.ops_tracker.filter_op = None;

                    self.senders.modify_state(|data| {
                        data.search.append_matches(list.0);
                        true
                    });
                }
            }
            event => {
                println!("************** DEBUG: Received callback: {event:?}");
                log::warn!("Unhandled callback: {event}");
            }
        }

        Ok(())
    }

    async fn handle_blocking_cmds(
        session: Arc<Session>,
        mut block_communication: ServiceBlockCommuniaction,
    ) {
        while let Some(cmd) = block_communication.block_cmd_rx.recv().await {
            match cmd {
                SessionBlockingCommand::GrabLines { range, sender } => {
                    match session.grab(range).await {
                        Ok(elements) => {
                            if sender.send(elements.0).is_err() {
                                log::error!("Communication error while sending grabbed lines");
                            }
                        }
                        Err(err) => {
                            log::error!("Grab error: {err:?}");

                            let notifi = AppNotification::SessionError {
                                session_id: session.get_uuid(),
                                error: err.into(),
                            };
                            block_communication.send_notification(notifi).await;
                        }
                    };
                }
                SessionBlockingCommand::GrabIndexedLines { range, sender } => {
                    match session.grab_indexed(range.clone()).await {
                        Ok(elements) => {
                            if sender.send(elements.0).is_err() {
                                log::error!(
                                    "Communication error while sending grabbed indexed lines"
                                );
                            }
                        }
                        Err(err) => {
                            log::error!("Indexed Grab Error: {err}");
                            let notifi = AppNotification::SessionError {
                                session_id: session.get_uuid(),
                                error: err.into(),
                            };
                            block_communication.send_notification(notifi).await;
                        }
                    }
                }
            }
        }

        //TODO AAZ: Keep this to make sure that session are dropped.
        println!(
            "****** DEBUG: Session Service {} has been dropped from blocking task",
            session.get_uuid()
        );
    }
}
