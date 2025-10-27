use eframe::NativeOptions;
use egui::vec2;

use crate::host::{self, data::HostState, service::HostService, ui::HostUI};

const APP_TITLE: &str = "Chipmunk";

#[derive(Debug)]
pub struct ChipmunkApp {
    host: HostUI,
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

                let host = HostUI::new(ui_comm);
                let app = Self { host };

                Ok(Box::new(app))
            }),
        )
    }
}

impl eframe::App for ChipmunkApp {
    fn update(&mut self, ctx: &egui::Context, frame: &mut eframe::Frame) {
        self.host.update(ctx, frame);
    }
}
