//! Session-tab clipboard commands for observed source metadata.

use egui::Ui;
use stypes::{ObserveOrigin, Transport};

use crate::{
    host::{notification::AppNotification, ui::UiActions},
    session::ui::Session,
};

impl Session {
    /// Renders clipboard commands for this session's tab.
    ///
    /// Returns `true` when at least one tab-specific command was rendered.
    pub fn render_tab_context_menu(&self, actions: &mut UiActions, ui: &mut Ui) -> bool {
        let Some(first_operation) = self.shared.observe.operations().first() else {
            return false;
        };

        match &first_operation.origin {
            ObserveOrigin::File(..) | ObserveOrigin::Concat(..) => {
                self.render_file_tab_menu(actions, ui)
            }
            ObserveOrigin::Stream(_, Transport::Process(..)) => {
                self.render_process_tab_menu(actions, ui)
            }
            ObserveOrigin::Stream(_, Transport::TCP(..)) => {
                self.render_address_tab_menu(actions, ui, tcp_address)
            }
            ObserveOrigin::Stream(_, Transport::UDP(..)) => {
                self.render_address_tab_menu(actions, ui, udp_address)
            }
            ObserveOrigin::Stream(_, Transport::Serial(..)) => {
                self.render_serial_tab_menu(actions, ui)
            }
        }
    }

    /// Renders clipboard commands for the session's observed files.
    ///
    /// Returns `true` when at least one file command was rendered.
    fn render_file_tab_menu(&self, actions: &mut UiActions, ui: &mut Ui) -> bool {
        let file_count = self.shared.observe.sources_count();
        if file_count == 0 {
            return false;
        }

        let path_label = match file_count {
            1 => String::from("Copy File Path"),
            count => format!("Copy {count} File Paths"),
        };
        if ui.button(path_label).clicked() {
            let paths = self.file_path_text();
            ui.ctx().copy_text(paths);

            let message = match file_count {
                1 => String::from("Copied 1 file path to clipboard."),
                count => format!("Copied {count} file paths to clipboard."),
            };
            actions.add_transient_notification(AppNotification::Info(message));
            ui.close();
        }

        let file_name_count = self.file_name_count();
        if file_name_count > 0 {
            let name_label = match file_name_count {
                1 => String::from("Copy File Name"),
                count => format!("Copy {count} File Names"),
            };
            if ui.button(name_label).clicked() {
                let names = self.file_name_text();
                ui.ctx().copy_text(names);

                let message = match file_name_count {
                    1 => String::from("Copied 1 file name to clipboard."),
                    count => format!("Copied {count} file names to clipboard."),
                };
                actions.add_transient_notification(AppNotification::Info(message));
                ui.close();
            }
        }

        true
    }

    /// Renders a clipboard command for the session's terminal commands.
    ///
    /// Returns `true` when at least one process command was rendered.
    fn render_process_tab_menu(&self, actions: &mut UiActions, ui: &mut Ui) -> bool {
        let command_count = self
            .shared
            .observe
            .operations()
            .iter()
            .filter(|operation| {
                matches!(
                    &operation.origin,
                    ObserveOrigin::Stream(_, Transport::Process(..))
                )
            })
            .count();
        if command_count == 0 {
            return false;
        }

        let label = match command_count {
            1 => String::from("Copy Command"),
            count => format!("Copy {count} Commands"),
        };
        if ui.button(label).clicked() {
            let commands = self.process_command_text();
            ui.ctx().copy_text(commands);

            let message = match command_count {
                1 => String::from("Copied 1 command to clipboard."),
                count => format!("Copied {count} commands to clipboard."),
            };
            actions.add_transient_notification(AppNotification::Info(message));
            ui.close();
        }

        true
    }

    /// Renders a clipboard command for the session's network addresses.
    ///
    /// Returns `true` when at least one address command was rendered.
    fn render_address_tab_menu(
        &self,
        actions: &mut UiActions,
        ui: &mut Ui,
        address_for: fn(&Transport) -> Option<&str>,
    ) -> bool {
        let address_count = self
            .shared
            .observe
            .operations()
            .iter()
            .filter_map(|operation| match &operation.origin {
                ObserveOrigin::Stream(_, transport) => address_for(transport),
                ObserveOrigin::File(..) | ObserveOrigin::Concat(..) => None,
            })
            .count();
        if address_count == 0 {
            return false;
        }

        let label = match address_count {
            1 => String::from("Copy Address"),
            count => format!("Copy {count} Addresses"),
        };
        if ui.button(label).clicked() {
            let addresses = self.address_text(address_for);
            ui.ctx().copy_text(addresses);

            let message = match address_count {
                1 => String::from("Copied 1 address to clipboard."),
                count => format!("Copied {count} addresses to clipboard."),
            };
            actions.add_transient_notification(AppNotification::Info(message));
            ui.close();
        }

        true
    }

    /// Renders a clipboard command for the session's serial ports.
    ///
    /// Returns `true` when at least one serial-port command was rendered.
    fn render_serial_tab_menu(&self, actions: &mut UiActions, ui: &mut Ui) -> bool {
        let port_count = self
            .shared
            .observe
            .operations()
            .iter()
            .filter(|operation| {
                matches!(
                    &operation.origin,
                    ObserveOrigin::Stream(_, Transport::Serial(..))
                )
            })
            .count();
        if port_count == 0 {
            return false;
        }

        let label = match port_count {
            1 => String::from("Copy Port"),
            count => format!("Copy {count} Ports"),
        };
        if ui.button(label).clicked() {
            let ports = self.serial_port_text();
            ui.ctx().copy_text(ports);

            let message = match port_count {
                1 => String::from("Copied 1 port to clipboard."),
                count => format!("Copied {count} ports to clipboard."),
            };
            actions.add_transient_notification(AppNotification::Info(message));
            ui.close();
        }

        true
    }

    fn file_path_text(&self) -> String {
        let mut text = String::new();
        let mut line_count = 0;
        for operation in self.shared.observe.operations() {
            match &operation.origin {
                ObserveOrigin::File(_, _, path) => {
                    append_line(&mut text, &path.to_string_lossy(), &mut line_count);
                }
                ObserveOrigin::Concat(files) => {
                    for (_, _, path) in files {
                        append_line(&mut text, &path.to_string_lossy(), &mut line_count);
                    }
                }
                ObserveOrigin::Stream(..) => {}
            }
        }
        text
    }

    fn file_name_count(&self) -> usize {
        self.shared
            .observe
            .operations()
            .iter()
            .map(|operation| match &operation.origin {
                ObserveOrigin::File(_, _, path) => {
                    let has_file_name = path.file_name().is_some();
                    usize::from(has_file_name)
                }
                ObserveOrigin::Concat(files) => files
                    .iter()
                    .filter(|(_, _, path)| path.file_name().is_some())
                    .count(),
                ObserveOrigin::Stream(..) => 0,
            })
            .sum()
    }

    fn file_name_text(&self) -> String {
        let mut text = String::new();
        let mut line_count = 0;
        for operation in self.shared.observe.operations() {
            match &operation.origin {
                ObserveOrigin::File(_, _, path) => {
                    if let Some(name) = path.file_name() {
                        append_line(&mut text, &name.to_string_lossy(), &mut line_count);
                    }
                }
                ObserveOrigin::Concat(files) => {
                    for name in files.iter().filter_map(|(_, _, path)| path.file_name()) {
                        append_line(&mut text, &name.to_string_lossy(), &mut line_count);
                    }
                }
                ObserveOrigin::Stream(..) => {}
            }
        }
        text
    }

    fn process_command_text(&self) -> String {
        let mut text = String::new();
        let mut line_count = 0;
        for operation in self.shared.observe.operations() {
            if let ObserveOrigin::Stream(_, Transport::Process(config)) = &operation.origin {
                append_line(&mut text, &config.command, &mut line_count);
            }
        }
        text
    }

    fn address_text(&self, address_for: fn(&Transport) -> Option<&str>) -> String {
        let mut text = String::new();
        let mut line_count = 0;
        for operation in self.shared.observe.operations() {
            let ObserveOrigin::Stream(_, transport) = &operation.origin else {
                continue;
            };
            if let Some(address) = address_for(transport) {
                append_line(&mut text, address, &mut line_count);
            }
        }
        text
    }

    fn serial_port_text(&self) -> String {
        let mut text = String::new();
        let mut line_count = 0;
        for operation in self.shared.observe.operations() {
            if let ObserveOrigin::Stream(_, Transport::Serial(config)) = &operation.origin {
                append_line(&mut text, &config.path, &mut line_count);
            }
        }
        text
    }
}

fn tcp_address(transport: &Transport) -> Option<&str> {
    match transport {
        Transport::TCP(config) => Some(&config.bind_addr),
        Transport::Process(..) | Transport::UDP(..) | Transport::Serial(..) => None,
    }
}

fn udp_address(transport: &Transport) -> Option<&str> {
    match transport {
        Transport::UDP(config) => Some(&config.bind_addr),
        Transport::Process(..) | Transport::TCP(..) | Transport::Serial(..) => None,
    }
}

fn append_line(text: &mut String, line: &str, line_count: &mut usize) {
    if *line_count > 0 {
        text.push('\n');
    }
    text.push_str(line);
    *line_count += 1;
}
