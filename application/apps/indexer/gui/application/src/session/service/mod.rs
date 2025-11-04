use tokio::select;
use tokio::sync::mpsc;
use uuid::Uuid;

use session_core::session::Session;
use stypes::{CallbackEvent, ObserveOptions};

use crate::host::event::HostEvent;
use crate::host::notification::AppNotification;
use crate::session::InitSessionError;
use crate::session::data::SearchTableIndex;
use crate::session::info::SessionInfo;

use super::communication::ServiceHandle;
use super::{command::SessionCommand, error::SessionError};

use operation_track::OperationTracker;

mod operation_track;

#[derive(Debug)]
pub struct SessionService {
    session_id: Uuid,
    communication: ServiceHandle,
    session: Session,
    ops_tracker: OperationTracker,
    callback_rx: mpsc::UnboundedReceiver<CallbackEvent>,
}

impl SessionService {
    /// Spawn session service returning the session ID.
    pub async fn spwan(
        communication: ServiceHandle,
        options: ObserveOptions,
    ) -> Result<SessionInfo, InitSessionError> {
        let session_id = Uuid::new_v4();
        let (session, callback_rx) = session_core::session::Session::new(session_id).await?;

        let session_info = SessionInfo::from_observe_options(session_id, &options);

        session.observe(Uuid::new_v4(), options)?;

        let service = Self {
            session_id,
            communication,
            session,
            ops_tracker: OperationTracker::default(),
            callback_rx,
        };

        tokio::spawn(async move {
            service.run().await;
        });

        Ok(session_info)
    }

    async fn run(mut self) {
        log::trace!("Start Session Service {}", self.session_id);

        loop {
            select! {
                Some(cmd) = self.communication.cmd_rx.recv() => {
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

        //TODO AAZ: Session isn't dropped automatically because of callback receiver.
        println!(
            "****** Session Service {} has been dropped",
            self.session_id
        );
    }

    async fn send_error(&self, error: SessionError) {
        let notifi = AppNotification::SessionError {
            session_id: self.session_id,
            error,
        };

        self.communication.senders.send_notification(notifi).await;
    }

    async fn handle_command(&mut self, cmd: SessionCommand) -> Result<(), SessionError> {
        match cmd {
            SessionCommand::GrabLines(grab_range) => {
                let elements = self.session.grab(grab_range).await?;
                self.communication.senders.modify_state(|data| {
                    data.main_table.append(elements.0);
                    true
                });
            }
            SessionCommand::GrabIndexedLines(grab_range) => {
                let elements = self.session.grab_indexed(grab_range.clone()).await?;
                self.communication.senders.modify_state(|data| {
                    let iter = grab_range.map(SearchTableIndex).zip(elements.0.into_iter());
                    data.search.search_table.append(iter);
                    true
                });
            }
            SessionCommand::ApplySearchFilter(search_filters) => {
                let op_id = Uuid::new_v4();
                debug_assert!(
                    self.ops_tracker.filter_op.is_none(),
                    "filter must be dropped before applying new one"
                );
                self.ops_tracker.filter_op = Some(op_id);
                self.session.apply_search_filters(op_id, search_filters)?;

                self.communication.senders.modify_state(|data| {
                    data.search.activate();
                    true
                });
            }
            SessionCommand::DropSearch => {
                if let Some(filter_op) = self.ops_tracker.filter_op.take() {
                    self.session.abort(Uuid::new_v4(), filter_op)?;
                }
                self.session.drop_search().await?;
                self.communication.senders.modify_state(|data| {
                    data.search.drop_search();
                    true
                });
            }
            SessionCommand::CloseSession => {
                for op_id in self.ops_tracker.get_all() {
                    self.session.abort(Uuid::new_v4(), op_id)?;
                }

                self.session.stop(Uuid::new_v4()).await?;

                self.communication
                    .senders
                    .send_host_event(HostEvent::CloseSession {
                        session_id: self.session_id,
                    })
                    .await;
            }
        }

        Ok(())
    }

    async fn handle_callbacks(&mut self, event: CallbackEvent) -> Result<(), SessionError> {
        println!("************** DEBUG: Received callback: {event:?}");

        log::trace!(
            "Received callback. Session: {}. Event: {}",
            self.session_id,
            event
        );
        match event {
            CallbackEvent::StreamUpdated(logs_count) => {
                self.communication.senders.modify_state(|state| {
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
                self.communication.senders.modify_state(|data| {
                    data.search.search_count = len;
                    true
                });
            }
            CallbackEvent::SearchMapUpdated(filter_matches) => {
                if let Some(list) = filter_matches {
                    // Long process ends when it deliver its initial results.
                    self.ops_tracker.filter_op = None;

                    self.communication.senders.modify_state(|data| {
                        data.search.append_matches(list.0);
                        true
                    });
                }
            }
            event => {
                log::warn!("Unhandled callback: {event}");
            }
        }

        Ok(())
    }
}
