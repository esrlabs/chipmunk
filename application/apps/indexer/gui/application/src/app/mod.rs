use eframe::NativeOptions;
use egui::{Context, vec2};

use crate::host::{
    self,
    communication::{UiHandle, UiReceivers},
    data::HostState,
    event::HostEvent,
    service::HostService,
    ui::UiComponents,
};

const APP_TITLE: &str = "Chipmunk";

#[derive(Debug)]
pub struct ChipmunkApp {
    receivers: UiReceivers,
    ui: UiComponents,
}

impl ChipmunkApp {
    pub fn run() -> eframe::Result<()> {
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
                let (ui_comm, service_comm) =
                    host::communication::init(ctx.egui_ctx.clone(), HostState::default());

                HostService::spawn(service_comm);

                let UiHandle { senders, receivers } = ui_comm;

                let ui = UiComponents::new(senders);
                let app = Self { ui, receivers };

                Ok(Box::new(app))
            }),
        )
    }

    fn handle_event(&mut self, event: HostEvent, ctx: &Context) {
        match event {
            HostEvent::CreateSession(info) => self.ui.add_session(info),
            HostEvent::Close => ctx.send_viewport_cmd(egui::ViewportCommand::Close),
        }
    }
}

impl eframe::App for ChipmunkApp {
    fn update(&mut self, ctx: &egui::Context, frame: &mut eframe::Frame) {
        while let Ok(event) = self.receivers.event_rx.try_recv() {
            self.handle_event(event, ctx);
        }

        while let Ok(notification) = self.receivers.notification_rx.try_recv() {
            self.ui.add_notification(notification);
        }

        self.ui
            .sessions
            .iter_mut()
            .for_each(|session| session.handle_events());

        self.ui.update(ctx, frame);
    }
}
