//! Source Data Exchange input bar for live observed sources.

use egui::{
    Align, AtomExt, Button, Frame, Id, Key, Layout, Margin, Modifiers, Popup, RectAlign, RichText,
    Stroke, TextEdit, Ui, vec2,
};
use egui_extras::{Size, StripBuilder};
use tokio::sync::mpsc::Sender;
use uuid::Uuid;

use stypes::{ObserveOrigin, Transport};

use crate::{
    common::phosphor::icons,
    host::{notification::AppNotification, ui::UiActions},
    session::{command::SessionCommand, error::SessionError, ui::shared::SessionShared},
};

/// Stateful UI for sending text into SDE-capable live sources.
#[derive(Debug)]
pub struct SdeBarUi {
    cmd_tx: Sender<SessionCommand>,
    targets: Vec<SdeTarget>,
    text: String,
    selected_target: Option<Uuid>,
    pending: bool,
}

#[derive(Debug)]
struct SdeTarget {
    id: Uuid,
    icon: &'static str,
    label: String,
}

impl SdeBarUi {
    /// Creates an SDE bar with targets from the current session state.
    pub fn new(cmd_tx: Sender<SessionCommand>, shared: &SessionShared) -> Self {
        let mut bar = Self {
            cmd_tx,
            targets: Vec::new(),
            text: String::default(),
            selected_target: None,
            pending: false,
        };
        bar.refresh_targets(shared);
        bar
    }

    /// Rebuilds the cached SDE targets from current observe operations.
    pub fn refresh_targets(&mut self, shared: &SessionShared) {
        self.targets = collect_eligible_targets(shared);
        if !self.pending {
            self.update_local_state();
        }
    }

    /// Returns whether the current session state can show stream input controls.
    pub fn is_available(&self) -> bool {
        self.pending || !self.targets.is_empty()
    }

    /// Renders the SDE controls and dispatches send commands.
    pub fn render_content(&mut self, actions: &mut UiActions, ui: &mut Ui) {
        let text_id = ui.id().with("sde_text");
        let enter_pressed = !self.pending && Self::text_enter_pressed(ui, text_id);
        let mut send_requested = enter_pressed;

        Frame::new()
            .inner_margin(Margin::same(2))
            .corner_radius(ui.visuals().widgets.inactive.corner_radius)
            .fill(ui.visuals().extreme_bg_color)
            .stroke(Self::control_stroke(ui, text_id))
            .show(ui, |ui| {
                ui.set_max_height(20.0);
                ui.add_enabled_ui(!self.pending, |ui| {
                    StripBuilder::new(ui)
                        .cell_layout(Layout::left_to_right(Align::Center))
                        .size(Size::relative(0.1).at_least(50.0).at_most(100.0))
                        .size(Size::exact(18.0))
                        .size(Size::remainder().at_least(80.0))
                        .size(Size::exact(62.0))
                        .horizontal(|mut strip| {
                            strip.cell(|ui| self.render_target_picker(ui));

                            strip.cell(|ui| {
                                ui.label(RichText::new(">>").monospace().strong());
                            });

                            strip.cell(|ui| {
                                TextEdit::singleline(&mut self.text)
                                    .id(text_id)
                                    .frame(Frame::NONE)
                                    .hint_text("Text to send")
                                    .desired_width(ui.available_width())
                                    .vertical_align(Align::Center)
                                    .show(ui);
                            });

                            strip.cell(|ui| {
                                let label = if self.pending { "Sending..." } else { "Send" };
                                let clicked = ui
                                    .add_enabled(
                                        self.can_send(),
                                        Button::new(label).min_size(ui.available_size()),
                                    )
                                    .clicked();
                                send_requested |= clicked;
                            });
                        });
                });
            });

        if self.can_send() && send_requested {
            self.send(actions);
        }
    }

    /// Applies a send result and reports failures through app notifications.
    pub fn handle_result(&mut self, result: Result<(), SessionError>, actions: &mut UiActions) {
        match result {
            Ok(()) => self.text.clear(),
            Err(error) => actions.add_notification(AppNotification::SessionError(error)),
        }

        self.pending = false;
        self.update_local_state();
    }

    /// Updates local bar state from the cached target list.
    ///
    /// Keeps the selected target valid while targets exist. Clears input,
    /// selection, and pending state when no target is available.
    fn update_local_state(&mut self) {
        if self.targets.is_empty() {
            self.clear();
            return;
        }

        let selected_available = self
            .selected_target
            .is_some_and(|selected| self.targets.iter().any(|target| target.id == selected));

        if !selected_available {
            self.selected_target = self.targets.first().map(|target| target.id);
        }
    }

    fn selected_target(&self) -> Option<&SdeTarget> {
        let selected = self.selected_target?;

        self.targets.iter().find(|target| target.id == selected)
    }

    fn render_target_picker(&mut self, ui: &mut Ui) {
        // Keep the icon box fixed so the larger glyph does not make rows taller.
        let target_atoms = |target: &SdeTarget| {
            (
                RichText::new(target.icon)
                    .size(14.0)
                    .atom_size(vec2(14.0, 15.0)),
                target.label.as_str().atom_shrink(true),
            )
        };

        let selected_target = self.selected_target();
        let hover_label = selected_target.map(|target| target.label.as_str());
        let button = match selected_target {
            Some(target) => Button::new(target_atoms(target)),
            None => Button::new("Select target"),
        }
        .frame_when_inactive(false)
        .truncate();

        let mut button_response = ui.add_sized(ui.available_size(), button);
        if let Some(label) = hover_label {
            button_response = button_response.on_hover_ui(|ui| {
                ui.set_max_width(ui.spacing().tooltip_width);
                ui.label(label);
            });
        }

        let mut selected_target = self.selected_target;
        Popup::menu(&button_response)
            .id(ui.id().with("sde_targets"))
            .align(RectAlign::BOTTOM_START)
            .show(|ui| {
                for target in &self.targets {
                    let button = Button::selectable(
                        selected_target == Some(target.id),
                        target_atoms(target),
                    );
                    if ui.add(button).clicked() {
                        selected_target = Some(target.id);
                        ui.close();
                    }
                }
            });
        self.selected_target = selected_target;
    }

    fn can_send(&self) -> bool {
        !self.pending && self.selected_target.is_some() && !self.text.is_empty()
    }

    fn send(&mut self, actions: &mut UiActions) {
        let Some(target) = self.selected_target else {
            return;
        };

        let command = SessionCommand::SendSdeText {
            target,
            text: self.text.clone(),
        };

        if actions.try_send_command(&self.cmd_tx, command) {
            self.pending = true;
        }
    }

    fn clear(&mut self) {
        let Self {
            cmd_tx: _,
            targets,
            text,
            selected_target,
            pending,
        } = self;

        targets.clear();
        text.clear();
        *selected_target = None;
        *pending = false;
    }

    fn text_enter_pressed(ui: &mut Ui, text_id: Id) -> bool {
        let text_focused = ui.memory(|memory| memory.focused().is_some_and(|id| id == text_id));

        text_focused && ui.input_mut(|input| input.consume_key(Modifiers::NONE, Key::Enter))
    }

    fn control_stroke(ui: &Ui, text_id: Id) -> Stroke {
        let noninteractive = &ui.visuals().widgets.noninteractive;
        if ui.memory(|memory| memory.focused().is_some_and(|id| id == text_id)) {
            Stroke::new(
                noninteractive.bg_stroke.width,
                ui.visuals().text_cursor.stroke.color,
            )
        } else {
            noninteractive.bg_stroke
        }
    }
}

fn collect_eligible_targets(shared: &SessionShared) -> Vec<SdeTarget> {
    shared
        .observe
        .operations()
        .iter()
        .filter(|operation| operation.processing())
        .filter_map(|operation| match &operation.origin {
            ObserveOrigin::Stream(_, Transport::Process(config)) => {
                let icon = icons::regular::TERMINAL_WINDOW;
                let label = config.command.clone();
                let target = SdeTarget {
                    id: operation.id,
                    icon,
                    label,
                };
                Some(target)
            }
            ObserveOrigin::Stream(_, Transport::Serial(config)) => {
                let icon = icons::regular::USB;
                let label = config.path.clone();
                let target = SdeTarget {
                    id: operation.id,
                    icon,
                    label,
                };
                Some(target)
            }
            ObserveOrigin::File(..)
            | ObserveOrigin::Concat(..)
            | ObserveOrigin::Stream(_, Transport::TCP(..) | Transport::UDP(..)) => None,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use tokio::{
        runtime::{Builder, Runtime},
        sync::mpsc,
    };

    use stypes::{
        ComputationError, FileFormat, ProcessTransportConfig, SerialTransportConfig,
        TCPTransportConfig, UDPTransportConfig,
    };

    use super::*;
    use crate::{
        host::{common::parsers::ParserNames, ui::UiActions},
        session::{
            types::{ObserveOperation, OperationPhase},
            ui::{SessionInfo, definitions::schema::LogSchemaSpec},
        },
    };

    fn command_sender() -> Sender<SessionCommand> {
        let (cmd_tx, _cmd_rx) = mpsc::channel(1);
        cmd_tx
    }

    fn ui_actions() -> (Runtime, UiActions) {
        let runtime = Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("test runtime should be created");
        let actions = UiActions::new(runtime.handle().clone());

        (runtime, actions)
    }

    fn sde_error() -> SessionError {
        ComputationError::Sde(String::new()).into()
    }

    fn shared_with(operation: ObserveOperation) -> SessionShared {
        let session_info = SessionInfo {
            id: Uuid::new_v4(),
            title: String::from("test"),
            parser: ParserNames::Text,
            raw_export_supported: false,
        };

        SessionShared::new(session_info, operation, LogSchemaSpec::Text)
    }

    fn add_operation(shared: &mut SessionShared, operation: ObserveOperation) {
        shared.add_operation(operation);
    }

    fn processing(mut operation: ObserveOperation) -> ObserveOperation {
        operation.set_phase(OperationPhase::Processing);
        operation
    }

    fn process_operation(command: &str) -> ObserveOperation {
        let config = ProcessTransportConfig {
            cwd: PathBuf::from("."),
            command: command.to_owned(),
            shell: None,
        };
        let source_id = Uuid::new_v4().to_string();
        let transport = Transport::Process(config);
        let origin = ObserveOrigin::Stream(source_id, transport);

        ObserveOperation::new(Uuid::new_v4(), origin)
    }

    fn serial_operation(path: &str) -> ObserveOperation {
        let config = SerialTransportConfig {
            path: path.to_owned(),
            baud_rate: 115_200,
            data_bits: 8,
            flow_control: 0,
            parity: 0,
            stop_bits: 1,
            send_data_delay: 0,
            exclusive: false,
        };
        let source_id = Uuid::new_v4().to_string();
        let transport = Transport::Serial(config);
        let origin = ObserveOrigin::Stream(source_id, transport);

        ObserveOperation::new(Uuid::new_v4(), origin)
    }

    fn tcp_operation() -> ObserveOperation {
        let config = TCPTransportConfig {
            bind_addr: String::from("127.0.0.1:9000"),
        };
        let source_id = Uuid::new_v4().to_string();
        let transport = Transport::TCP(config);
        let origin = ObserveOrigin::Stream(source_id, transport);

        ObserveOperation::new(Uuid::new_v4(), origin)
    }

    fn udp_operation() -> ObserveOperation {
        let config = UDPTransportConfig {
            bind_addr: String::from("127.0.0.1:9001"),
            multicast: Vec::new(),
        };
        let source_id = Uuid::new_v4().to_string();
        let transport = Transport::UDP(config);
        let origin = ObserveOrigin::Stream(source_id, transport);

        ObserveOperation::new(Uuid::new_v4(), origin)
    }

    fn file_operation() -> ObserveOperation {
        let source_id = String::from("file");
        let path = PathBuf::from("test.log");
        let origin = ObserveOrigin::File(source_id, FileFormat::Text, path);

        ObserveOperation::new(Uuid::new_v4(), origin)
    }

    #[test]
    fn eligible_targets_are_processing_process_or_serial_streams() {
        let process_source = process_operation("cat");
        let process = processing(process_source);
        let process_id = process.id;
        let serial_source = serial_operation("/dev/ttyUSB0");
        let serial = processing(serial_source);
        let serial_id = serial.id;

        let tcp_source = tcp_operation();
        let tcp = processing(tcp_source);
        let mut shared = shared_with(tcp);
        let udp_source = udp_operation();
        let udp = processing(udp_source);
        add_operation(&mut shared, udp);
        let file = file_operation();
        add_operation(&mut shared, file);
        let initializing_process = process_operation("initializing");
        add_operation(&mut shared, initializing_process);
        add_operation(&mut shared, process);
        add_operation(&mut shared, serial);

        let targets = collect_eligible_targets(&shared);
        let target_ids: Vec<_> = targets.iter().map(|target| target.id).collect();

        assert_eq!(target_ids, vec![process_id, serial_id]);
    }

    #[test]
    fn refresh_selects_first_target_and_reselects_when_it_stops() {
        let first_source = process_operation("first");
        let first = processing(first_source);
        let first_id = first.id;
        let second_source = process_operation("second");
        let second = processing(second_source);
        let second_id = second.id;

        let mut shared = shared_with(first);
        add_operation(&mut shared, second);
        let mut bar = SdeBarUi::new(command_sender(), &shared);

        assert!(bar.is_available());
        assert_eq!(bar.selected_target, Some(first_id));

        shared
            .observe
            .update_operation(first_id, OperationPhase::Success);
        assert_eq!(bar.selected_target, Some(first_id));

        bar.refresh_targets(&shared);
        assert!(bar.is_available());
        assert_eq!(bar.selected_target, Some(second_id));
    }

    #[test]
    fn pending_send_keeps_bar_visible_after_targets_stop() {
        let source = process_operation("cat");
        let operation = processing(source);
        let operation_id = operation.id;
        let mut shared = shared_with(operation);
        let mut bar = SdeBarUi::new(command_sender(), &shared);
        bar.text = String::from("status");
        bar.pending = true;

        shared
            .observe
            .update_operation(operation_id, OperationPhase::Success);
        bar.refresh_targets(&shared);

        assert!(bar.is_available());
        assert!(bar.targets.is_empty());
        assert!(!bar.text.is_empty());
        assert_eq!(bar.selected_target, Some(operation_id));
        assert!(bar.pending);
    }

    #[test]
    fn bar_clears_only_after_no_targets_and_no_pending_send() {
        let source = process_operation("cat");
        let operation = processing(source);
        let operation_id = operation.id;
        let mut shared = shared_with(operation);
        let mut bar = SdeBarUi::new(command_sender(), &shared);
        bar.text = String::from("status");
        bar.pending = true;

        shared
            .observe
            .update_operation(operation_id, OperationPhase::Success);
        bar.refresh_targets(&shared);
        assert!(bar.is_available());

        let (_runtime, mut actions) = ui_actions();
        bar.handle_result(Err(sde_error()), &mut actions);

        assert!(!bar.is_available());
        assert!(bar.targets.is_empty());
        assert!(bar.text.is_empty());
        assert_eq!(bar.selected_target, None);
        assert!(!bar.pending);
    }

    #[test]
    fn failure_keeps_input_when_another_target_remains_visible() {
        let stopped_source = process_operation("stopped");
        let stopped = processing(stopped_source);
        let stopped_id = stopped.id;
        let remaining_source = process_operation("remaining");
        let remaining = processing(remaining_source);
        let remaining_id = remaining.id;

        let mut shared = shared_with(stopped);
        add_operation(&mut shared, remaining);
        let mut bar = SdeBarUi::new(command_sender(), &shared);
        bar.text = String::from("status");
        bar.selected_target = Some(stopped_id);
        bar.pending = true;

        shared
            .observe
            .update_operation(stopped_id, OperationPhase::Success);
        bar.refresh_targets(&shared);
        let (_runtime, mut actions) = ui_actions();
        bar.handle_result(Err(sde_error()), &mut actions);

        assert!(bar.is_available());
        assert!(!bar.text.is_empty());
        assert_eq!(bar.selected_target, Some(remaining_id));
    }
}
