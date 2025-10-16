use eframe::NativeOptions;
use egui::{Context, vec2};
use tokio::sync::{mpsc::error::TryRecvError, watch};

use crate::{
    core::{
        communication::{UiCommunication, UiReceivers},
        events::AppEvent,
    },
    state::AppState,
    ui::{SessionInfo, UiComponents},
};

const APP_TITLE: &str = "Chipmunk";

#[derive(Debug)]
pub struct ChipmunkApp {
    receivers: UiReceivers,
    ui: UiComponents,
}

impl ChipmunkApp {
    pub fn run(comm: UiCommunication) -> eframe::Result<()> {
        let UiCommunication { senders, receivers } = comm;

        let native_options = NativeOptions {
            viewport: egui::ViewportBuilder::default()
                .with_title(APP_TITLE)
                .with_inner_size(vec2(1200., 900.)),
            ..Default::default()
        };

        eframe::run_native(
            APP_TITLE,
            native_options,
            Box::new(|ctx| {
                Self::spawn_repaint_listner(ctx.egui_ctx.clone(), receivers.app_state_rx.clone());

                let ui = UiComponents::new(senders);
                let app = Self { ui, receivers };

                Ok(Box::new(app))
            }),
        )
    }

    fn spawn_repaint_listner(ctx: egui::Context, mut repaint_rx: watch::Receiver<AppState>) {
        tokio::spawn(async move {
            while let Ok(()) = repaint_rx.changed().await {
                ctx.request_repaint();
            }
        });
    }

    fn handle_event(&mut self, event: AppEvent, ctx: &Context) {
        match event {
            AppEvent::CreateSession { title } => {
                let info = SessionInfo { title };
                self.ui.add_session(info);
            }
            AppEvent::Close => ctx.send_viewport_cmd(egui::ViewportCommand::Close),
        }
    }
}

impl eframe::App for ChipmunkApp {
    fn update(&mut self, ctx: &egui::Context, frame: &mut eframe::Frame) {
        loop {
            match self.receivers.event_rx.try_recv() {
                Ok(event) => self.handle_event(event, ctx),
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => {
                    //TODO AAZ: better error handling.
                    eprintln!("Communication error: State sender dropped");
                    std::process::exit(1);
                }
            }
        }

        self.ui.update(ctx, frame);
    }
}
