use egui::Ui;

use crate::{
    common::ui::visibility_tracker::VisibilityTracker,
    host::ui::session_setup::state::sources::TcpConfig,
};

use super::{ConfigBindAddress, RenderOutcome, render_socket_address};

impl ConfigBindAddress for TcpConfig {
    fn bind_addr(&mut self) -> &mut String {
        &mut self.bind_addr
    }

    fn validate(&mut self) {
        self.validate();
    }

    fn is_valid(&self) -> bool {
        self.is_valid()
    }

    fn bind_err_msg(&self) -> Option<&str> {
        self.get_err_msg()
    }
}

pub fn render_connection(
    config: &mut TcpConfig,
    input_visibility: &mut VisibilityTracker,
    ui: &mut Ui,
) -> RenderOutcome {
    render_socket_address(config, input_visibility, ui)
}
