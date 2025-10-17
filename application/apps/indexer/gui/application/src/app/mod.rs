use eframe::NativeOptions;
use egui::{Context, vec2};
use tokio::sync::watch;

use crate::host::{
    communication::{UiHandle, UiReceivers},
    event::HostEvent,
    ui::UiComponents,
};

const APP_TITLE: &str = "Chipmunk";

#[derive(Debug)]
pub struct ChipmunkApp {
    receivers: UiReceivers,
    ui: UiComponents,
}

impl ChipmunkApp {
    pub fn run(comm: UiHandle) -> eframe::Result<()> {
        let UiHandle { senders, receivers } = comm;

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
                Self::spawn_repaint_listner(ctx.egui_ctx.clone(), receivers.host_state_rx.clone());

                let ui = UiComponents::new(senders);
                let app = Self { ui, receivers };

                Ok(Box::new(app))
            }),
        )
    }

    fn spawn_repaint_listner<T>(ctx: egui::Context, mut repaint_rx: watch::Receiver<T>)
    where
        T: Send + Sync + 'static,
    {
        tokio::spawn(async move {
            while let Ok(()) = repaint_rx.changed().await {
                ctx.request_repaint();
            }
        });
    }

    fn handle_event(&mut self, event: HostEvent, ctx: &Context) {
        match event {
            HostEvent::CreateSession(info) => {
                // TODO AAZ: Check if using tokio_stream::WatchStream is better than
                // spawning a task on each tab.
                Self::spawn_repaint_listner(
                    ctx.to_owned(),
                    info.communication.receivers.session_state_rx.clone(),
                );

                self.ui.add_session(info);
            }
            HostEvent::Close => ctx.send_viewport_cmd(egui::ViewportCommand::Close),
        }
    }
}

impl eframe::App for ChipmunkApp {
    fn update(&mut self, ctx: &egui::Context, frame: &mut eframe::Frame) {
        //TODO AAZ: We need to check for events outside of the update call.
        while let Ok(event) = self.receivers.event_rx.try_recv() {
            self.handle_event(event, ctx);
        }

        self.ui.update(ctx, frame);
    }
}
