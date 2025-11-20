use eframe::NativeOptions;
use egui::vec2;

use crate::{
    cli::CliCommand,
    host::{self, service::HostService, ui::HostUI},
};

const APP_TITLE: &str = "Chipmunk";

#[derive(Debug)]
pub struct ChipmunkApp {
    host: HostUI,
}

impl ChipmunkApp {
    pub fn run(cli_cmds: Vec<CliCommand>) -> eframe::Result<()> {
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
                let (ui_comm, service_comm) = host::communication::init(ctx.egui_ctx.clone());

                let tokio_handle = HostService::spawn(service_comm);

                let host = HostUI::new(ui_comm, tokio_handle);
                let mut app = Self { host };

                app.host.handle_cli(cli_cmds);

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
