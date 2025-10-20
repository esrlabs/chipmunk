use egui::{
    Button, Color32, Frame, Id, Label, Layout, Margin, Modal, ModalResponse, NumExt, Popup,
    PopupAnchor, RectAlign, RichText, ScrollArea, Sense, Ui, Vec2, pos2, vec2,
};

use crate::{
    fixed_queue::FixedQueue,
    host::{error::HostError, notification::AppNotification},
};

/// The maximum amount of notifications to store.
const NOTIFICATIONS_LIMIT: usize = 30;

/// Slim representation for notification level for internal use.
#[derive(Debug, Clone, Copy, PartialEq, PartialOrd)]
enum NotificationLevel {
    Info = 0,
    Warning,
    Error,
}

impl From<&AppNotification> for NotificationLevel {
    fn from(value: &AppNotification) -> Self {
        use AppNotification as Not;
        use NotificationLevel as Level;

        match value {
            Not::HostError(HostError::InitSessionError(..)) => Level::Error,
            Not::HostError(HostError::SendEvent(..)) => Level::Error,
            Not::HostError(HostError::NativeError(err)) => match err.severity {
                stypes::Severity::WARNING => Level::Warning,
                stypes::Severity::ERROR => Level::Error,
            },
            Not::Info(..) => Level::Info,
        }
    }
}

#[derive(Debug)]
pub struct NotificationUi {
    queue: FixedQueue<AppNotification>,
    popup_id: egui::Id,
    /// The top notification level for the unseen notifications.
    unseen_top_level: Option<NotificationLevel>,
    /// Notification message to show in modal dialog.
    modal_notification_msg: Option<String>,
}

impl Default for NotificationUi {
    fn default() -> Self {
        Self {
            popup_id: egui::Id::new("notification_popup"),
            queue: FixedQueue::new(NOTIFICATIONS_LIMIT),
            unseen_top_level: None,
            modal_notification_msg: None,
        }
    }
}

impl NotificationUi {
    pub fn add(&mut self, notification: AppNotification) {
        // Update unseen notification
        let level = NotificationLevel::from(&notification);
        if let Some(current) = self.unseen_top_level.as_mut() {
            if level > *current {
                *current = level;
            }
        } else {
            self.unseen_top_level = Some(level);
        }

        // Add item
        self.queue.add_item(notification);
    }

    /// Renders the notification button with their popup + notification
    /// message in modal box when available.
    pub fn render_content(&mut self, ui: &mut Ui) {
        // Button.
        let button = Button::new("🔔").frame(true).frame_when_inactive(false);
        let button_res = ui.add(button).on_hover_text("Notifications");

        // Check if modal window with notification message should show,
        // otherwise check if the notifications popup should be shown.
        match self.modal_notification_msg.as_ref() {
            Some(msg) => {
                // Modal notification message.
                let modal = Self::show_modal_notification(msg, ui);
                if modal.should_close() {
                    self.modal_notification_msg = None;
                }
            }
            None => {
                // Notifications Popup.
                const GAB: f32 = 3.0;
                Popup::menu(&button_res)
                    .id(self.popup_id)
                    .close_behavior(egui::PopupCloseBehavior::CloseOnClickOutside)
                    .anchor(PopupAnchor::Position(pos2(
                        ui.ctx().content_rect().right() - GAB,
                        ui.max_rect().bottom() + GAB,
                    )))
                    .align(RectAlign::BOTTOM_END)
                    .show(|ui| {
                        self.unseen_top_level = None;
                        self.popup_content(ui);
                    });
            }
        };

        // Render small circle on unseen notifications.
        if let Some(unseen) = self.unseen_top_level {
            let pos = button_res.rect.right_top() + vec2(-2.0, 2.0);
            let radius = 3.;
            let color = match unseen {
                NotificationLevel::Info => Color32::CYAN,
                NotificationLevel::Warning => Color32::YELLOW,
                NotificationLevel::Error => Color32::RED,
            };

            ui.painter().circle_filled(pos, radius, color);
        }
    }

    /// Render the content of the notifications popup.
    fn popup_content(&mut self, ui: &mut Ui) {
        let panel_width = (ui.ctx().content_rect().width() - 20.)
            .at_least(20.)
            .at_most(350.);
        let panel_height = (ui.ctx().content_rect().height() - 100.)
            .at_least(20.)
            .at_most(400.);

        ui.set_max_width(panel_width);
        ui.set_max_height(panel_height);

        // Title + Close button.
        ui.horizontal_top(|ui| {
            if self.queue.is_empty() {
                ui.label("Notifications");
            } else {
                ui.label(format!("Notifications ({})", self.queue.len()));
            }

            ui.with_layout(Layout::right_to_left(egui::Align::TOP), |ui| {
                let close_res = ui.button("❌").on_hover_text("Close");

                if close_res.clicked() {
                    ui.close();
                }

                if !self.queue.is_empty() {
                    let clear_res = ui.button("🗑").on_hover_text("Clear Notifications.");

                    if clear_res.clicked() {
                        self.queue.clear();
                    }
                }
            })
        });

        // Notifications
        egui::ScrollArea::vertical()
            .min_scrolled_height(panel_height / 2.)
            .max_height(panel_height)
            .show(ui, |ui| {
                if self.queue.is_empty() {
                    ui.label(RichText::new("No Notifications available.").weak());
                    return;
                }

                let symbol_size = Vec2::splat(8.0);

                for item in self.queue.all_items() {
                    const ITEMS_MARGIN: f32 = 0.5;

                    ui.add_space(ITEMS_MARGIN);

                    let (color, notification_msg) = match item {
                        AppNotification::HostError(err) => match err {
                            HostError::InitSessionError(..) => (Color32::RED, err.to_string()),
                            HostError::SendEvent(..) => (Color32::RED, err.to_string()),
                            HostError::NativeError(native_error) => match native_error.severity {
                                stypes::Severity::WARNING => (Color32::YELLOW, err.to_string()),
                                stypes::Severity::ERROR => (Color32::RED, err.to_string()),
                            },
                        },
                        AppNotification::Info(msg) => (Color32::CYAN, msg.clone()),
                    };

                    ui.horizontal(|ui| {
                        let (respond, painter) = ui.allocate_painter(symbol_size, Sense::empty());
                        let center = respond.rect.center();
                        let radius = respond.rect.width() / 2.0;

                        painter.circle_filled(center, radius, color);

                        let button = Button::new(&notification_msg).truncate();
                        if ui.add(button).clicked() {
                            self.modal_notification_msg = Some(notification_msg);
                        }
                    });

                    ui.add_space(ITEMS_MARGIN);
                }
            });
    }

    /// Shows modal window with notification message.
    fn show_modal_notification(notification_msg: &str, ui: &mut Ui) -> ModalResponse<()> {
        Modal::new(Id::new("notification_modal"))
            .frame(Frame::window(ui.style()).inner_margin(Margin::same(8)))
            .show(ui.ctx(), |ui| {
                let modal_width = (ui.ctx().content_rect().width() - 20.)
                    .at_least(20.)
                    .at_most(350.);

                ui.set_width(modal_width);

                ui.heading("Notification Message");
                ui.add_space(8.);

                ScrollArea::vertical().max_height(12.).show(ui, |ui| {
                    let msg_lbl = Label::new(notification_msg).wrap_mode(egui::TextWrapMode::Wrap);
                    ui.add(msg_lbl);
                });
            })
    }
}
