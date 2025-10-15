use eframe::NativeOptions;
use egui::vec2;

use crate::ui::UiComponenets;

const APP_TITLE: &str = "Chipmunk";

#[derive(Debug)]
pub struct ChipmunkApp {
    ui: UiComponenets,
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
            Box::new(|_ctx| {
                let ui = UiComponenets::new();
                let app = Self { ui };

                Ok(Box::new(app))
            }),
        )
    }
}

impl eframe::App for ChipmunkApp {
    fn update(&mut self, ctx: &egui::Context, frame: &mut eframe::Frame) {
        let Self { ui } = self;

        ui.update(ctx, frame);
    }
}
