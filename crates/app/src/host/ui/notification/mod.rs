//! Host notification UI, including the history popup and latest-message banner.

mod banner;

use egui::{
    Align, Button, Color32, Frame, Id, Label, Layout, Margin, Modal, ModalResponse, NumExt, Popup,
    PopupAnchor, PopupCloseBehavior, Rect, RectAlign, RichText, ScrollArea, Sense, TextWrapMode,
    Ui, Vec2, pos2, vec2,
};
use stypes::Severity;

use crate::{
    common::{
        fixed_queue::FixedQueue,
        phosphor::{self, icons},
    },
    host::{common::colors, error::HostError, notification::AppNotification},
    session::error::SessionError,
};

use self::banner::NotificationBanner;

/// Stores host notifications and renders their button, popup, modal, and banner.
#[derive(Debug)]
pub struct NotificationUi {
    queue: FixedQueue<NotificationEntry>,
    popup_id: egui::Id,
    /// The top notification level for the unseen notifications.
    unseen_top_level: Option<NotificationLevel>,
    /// Notification message to show in modal dialog.
    modal_notification_msg: Option<String>,
    active_banner: Option<NotificationBanner>,
}

/// Display-ready notification data shared by the popup and banner.
#[derive(Debug, Clone)]
struct NotificationEntry {
    level: NotificationLevel,
    message: String,
}

/// Slim representation for notification level for internal use.
#[derive(Debug, Clone, Copy, PartialEq, PartialOrd)]
enum NotificationLevel {
    Info = 0,
    Warning,
    Error,
}

impl Default for NotificationUi {
    /// Creates empty notification UI state.
    fn default() -> Self {
        const NOTIFICATIONS_LIMIT: usize = 30;

        Self {
            popup_id: egui::Id::new("notification_popup"),
            queue: FixedQueue::new(NOTIFICATIONS_LIMIT),
            unseen_top_level: None,
            modal_notification_msg: None,
            active_banner: None,
        }
    }
}

impl NotificationUi {
    /// Adds a notification to history and shows it as the active banner.
    pub fn add(&mut self, notification: AppNotification) {
        let entry = NotificationEntry::from(notification);

        if let Some(current) = self.unseen_top_level.as_mut() {
            if entry.level > *current {
                *current = entry.level;
            }
        } else {
            self.unseen_top_level = Some(entry.level);
        }

        let active_banner = NotificationBanner::new(entry.clone());
        self.active_banner = Some(active_banner);
        self.queue.add_item(entry);
    }

    /// Renders the notification button with its popup, modal message, and latest banner.
    pub fn render_content(&mut self, ui: &mut Ui) {
        let popup_open = Popup::is_id_open(ui.ctx(), self.popup_id);
        if popup_open {
            self.active_banner = None;
        }

        // Notification Button
        let bell_txt = RichText::new(icons::fill::BELL)
            .family(phosphor::fill_font_family())
            .size(16.);
        let button = Button::selectable(popup_open, bell_txt)
            .frame(true)
            .frame_when_inactive(false);
        let button_res = ui.add(button).on_hover_text("Notifications");

        // Notification menu + Details modal
        match self.modal_notification_msg.as_ref() {
            Some(msg) => {
                let modal = Self::show_modal_notification(msg, ui);
                if modal.should_close() {
                    self.modal_notification_msg = None;
                }
            }
            None => {
                const POPUP_GAP: f32 = 3.0;
                let anchor_pos = pos2(
                    ui.content_rect().right() - POPUP_GAP,
                    ui.max_rect().bottom() + POPUP_GAP,
                );
                let popup_anchor = PopupAnchor::Position(anchor_pos);
                Popup::menu(&button_res)
                    .id(self.popup_id)
                    .close_behavior(PopupCloseBehavior::CloseOnClickOutside)
                    .anchor(popup_anchor)
                    .align(RectAlign::BOTTOM_END)
                    .show(|ui| {
                        self.active_banner = None;
                        self.unseen_top_level = None;
                        self.popup_content(ui);
                    });
            }
        };

        if let Some(unseen) = self.unseen_top_level {
            let pos = button_res.rect.right_top() + vec2(-2.0, 2.0);
            let radius = 3.;
            let color = unseen.color(ui.visuals().dark_mode);

            ui.painter().circle_filled(pos, radius, color);
        }

        // Banner
        if !Popup::is_id_open(ui.ctx(), self.popup_id) {
            self.render_banner(button_res.rect, ui);
        }
    }

    /// Renders and advances the latest notification banner.
    fn render_banner(&mut self, button_rect: Rect, ui: &mut Ui) {
        let Some(banner) = self.active_banner.as_mut() else {
            return;
        };

        let clicked = banner.render(button_rect, ui);
        if clicked {
            // Dismiss the banner and mark notifications as seen on click.
            self.active_banner = None;
            self.unseen_top_level = None;
        } else if banner.expired() {
            self.active_banner = None;
        }
    }

    /// Renders the notification history popup content.
    fn popup_content(&mut self, ui: &mut Ui) {
        let panel_width = (ui.content_rect().width() - 20.)
            .at_least(20.)
            .at_most(350.);
        let panel_height = (ui.content_rect().height() - 100.)
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

            ui.with_layout(Layout::right_to_left(Align::TOP), |ui| {
                let close_res = ui.button(icons::regular::X).on_hover_text("Close");

                if close_res.clicked() {
                    ui.close();
                }

                if !self.queue.is_empty() {
                    let clear_res = ui
                        .button(icons::regular::TRASH)
                        .on_hover_text("Clear Notifications.");

                    if clear_res.clicked() {
                        self.queue.clear();
                    }
                }
            })
        });

        // Notifications
        ScrollArea::vertical()
            .min_scrolled_height(panel_height / 2.)
            .max_height(panel_height)
            .show(ui, |ui| {
                if self.queue.is_empty() {
                    ui.label(RichText::new("No Notifications available.").weak());
                    return;
                }

                let symbol_size = Vec2::splat(8.0);

                for entry in self.queue.all_items() {
                    const ITEMS_MARGIN: f32 = 0.5;

                    ui.add_space(ITEMS_MARGIN);

                    ui.horizontal(|ui| {
                        let (respond, painter) = ui.allocate_painter(symbol_size, Sense::empty());
                        let center = respond.rect.center();
                        let radius = respond.rect.width() / 2.0;
                        let color = entry.level.color(ui.visuals().dark_mode);

                        painter.circle_filled(center, radius, color);

                        let button = Button::new(&entry.message).truncate();
                        if ui.add(button).clicked() {
                            self.modal_notification_msg = Some(entry.message.clone());
                        }
                    });

                    ui.add_space(ITEMS_MARGIN);
                }
            });
    }

    /// Shows a modal with the full notification message.
    fn show_modal_notification(notification_msg: &str, ui: &mut Ui) -> ModalResponse<()> {
        Modal::new(Id::new("notification_modal"))
            .frame(Frame::window(ui.style()).inner_margin(Margin::same(8)))
            .show(ui.ctx(), |ui| {
                let modal_width = (ui.content_rect().width() - 20.)
                    .at_least(20.)
                    .at_most(350.);

                ui.set_width(modal_width);

                ui.heading("Notification Message");
                ui.add_space(8.);

                ScrollArea::vertical().max_height(12.).show(ui, |ui| {
                    let msg_lbl = Label::new(notification_msg)
                        .selectable(true)
                        .wrap_mode(TextWrapMode::Wrap);
                    ui.add(msg_lbl);
                });
            })
    }
}

impl NotificationLevel {
    /// Returns the accent color used for this notification level.
    pub fn color(self, dark_mode: bool) -> Color32 {
        match self {
            NotificationLevel::Info => colors::notification_info_color(dark_mode),
            NotificationLevel::Warning => colors::notification_warning_color(dark_mode),
            NotificationLevel::Error => colors::notification_error_color(dark_mode),
        }
    }
}

impl From<&AppNotification> for NotificationLevel {
    /// Maps an application notification to its display level.
    fn from(value: &AppNotification) -> Self {
        use AppNotification as Not;
        use NotificationLevel as Level;

        match value {
            Not::HostError(HostError::InitSessionError(..)) => Level::Error,
            Not::HostError(HostError::NativeError(err))
            | Not::SessionError(SessionError::NativeError(err)) => match err.severity {
                Severity::WARNING => Level::Warning,
                Severity::ERROR => Level::Error,
            },
            Not::SessionError(..) => Level::Error,
            Not::Error(..) | Not::UiError(..) => Level::Error,
            Not::Warning(..) => Level::Warning,
            Not::Info(..) => Level::Info,
        }
    }
}

impl From<AppNotification> for NotificationEntry {
    /// Converts a notification into cached display data.
    fn from(notification: AppNotification) -> Self {
        let level = NotificationLevel::from(&notification);
        let message = match notification {
            AppNotification::HostError(err) => err.to_string(),
            AppNotification::SessionError(error) => error.to_string(),
            AppNotification::Error(msg)
            | AppNotification::UiError(msg)
            | AppNotification::Warning(msg)
            | AppNotification::Info(msg) => msg,
        };

        Self { level, message }
    }
}
