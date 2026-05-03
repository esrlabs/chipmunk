use std::f32::consts::FRAC_PI_2;

use egui::{
    Button, Label, Layout, Rect, RichText, Sense, Spinner, Ui, UiBuilder, Widget as _, pos2, vec2,
};
use stypes::AttachmentInfo;
use uuid::Uuid;

use crate::{
    common::{
        modal::{ModalSize, ResponsiveModalSize, show_modal},
        phosphor::icons,
    },
    session::{
        types::attachment::PreviewContent,
        ui::shared::{AttachmentModalState, AttachmentsState},
    },
};

const HEADER_HEIGHT: f32 = 32.0;
const HEADER_SPACING: f32 = 8.0;
const FRAME_INNER_MARGIN: f32 = 8.0;
const ATTACHMENT_MODAL_SIZE: ResponsiveModalSize = ResponsiveModalSize {
    width_ratio: 0.60,
    height_ratio: 0.60,
    min_size: vec2(600.0, 360.0),
    max_size: vec2(1100.0, 800.0),
    window_padding: vec2(20.0, 40.0),
};

#[derive(Debug, Default)]
pub struct AttachmentModalUi {
    image_attachment: Option<Uuid>,
    /// Image rotation state.
    image_quarter_turns: u8,
}

impl AttachmentModalUi {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn render_content(&mut self, attachments: &mut AttachmentsState, ui: &Ui) {
        if attachments.preview_modal().closed() {
            return;
        }

        self.sync_image_state(attachments.preview_modal());

        let mut close = false;

        let modal = show_modal(
            ui,
            "attachment-preview",
            ModalSize::Responsive(ATTACHMENT_MODAL_SIZE),
            |ui, modal_size| {
                if self.render_header(attachments.preview_modal(), ui) {
                    close = true;
                }

                ui.add_space(HEADER_SPACING);

                let body_size = vec2(
                    modal_size.x,
                    (modal_size.y - HEADER_HEIGHT - HEADER_SPACING).max(0.0),
                );
                self.render_body(attachments.preview_modal(), body_size, ui);
            },
        );

        if close || modal.should_close() {
            self.image_attachment = None;
            self.image_quarter_turns = 0;
            attachments.close_preview_modal();
        }
    }

    fn sync_image_state(&mut self, state: &AttachmentModalState) {
        let AttachmentModalState::Content {
            attachment,
            content: PreviewContent::Image(_),
        } = state
        else {
            self.image_attachment = None;
            self.image_quarter_turns = 0;
            return;
        };

        if self.image_attachment != Some(attachment.uuid) {
            self.image_attachment = Some(attachment.uuid);
            self.image_quarter_turns = 0;
        }
    }

    fn render_header(&self, state: &AttachmentModalState, ui: &mut Ui) -> bool {
        let Some(title) = modal_title(state) else {
            return false;
        };

        let mut close = false;
        ui.allocate_ui_with_layout(
            vec2(ui.available_width(), HEADER_HEIGHT),
            Layout::right_to_left(egui::Align::Center),
            |ui| {
                close = close_icon_button(ui);
                ui.add_space(4.0);

                let title_size = vec2(ui.available_width(), HEADER_HEIGHT);
                ui.allocate_ui_with_layout(
                    title_size,
                    Layout::left_to_right(egui::Align::Center),
                    |ui| render_title(title, ui),
                );
            },
        );

        close
    }

    fn render_body(&mut self, state: &AttachmentModalState, size: egui::Vec2, ui: &mut Ui) {
        match state {
            AttachmentModalState::Closed => {}
            AttachmentModalState::Pending { .. } => render_centered_status(size, ui, |ui| {
                Spinner::new().size(25.0).ui(ui);
            }),
            AttachmentModalState::Content {
                attachment,
                content,
            } => self.render_preview_content(attachment, content, size, ui),
            AttachmentModalState::NotSupported { .. } => render_centered_status(size, ui, |ui| {
                ui.label(RichText::new("Preview unavailable for this attachment type.").weak());
            }),
        }
    }

    fn render_preview_content(
        &mut self,
        attachment: &AttachmentInfo,
        content: &PreviewContent,
        size: egui::Vec2,
        ui: &mut Ui,
    ) {
        match content {
            PreviewContent::Text(content) => {
                render_content_frame(size, ui, |ui, inner_size| {
                    render_text(content, attachment.uuid, inner_size, ui);
                });
            }
            PreviewContent::Image(texture) => {
                let frame_rect = render_content_frame(size, ui, |ui, inner_size| {
                    self.render_image(texture, inner_size, ui)
                });
                let (counter_clicked, clockwise_clicked) =
                    render_image_rotation_buttons(ui, frame_rect);
                if counter_clicked {
                    self.rotate_counter_clockwise();
                }
                if clockwise_clicked {
                    self.rotate_clockwise();
                }
            }
        }
    }

    fn render_image(&self, texture: &egui::TextureHandle, max_size: egui::Vec2, ui: &mut Ui) {
        let image_size = texture.size_vec2();
        if image_size.x <= 0.0 || image_size.y <= 0.0 {
            return;
        }

        let rotated_bounds = rotated_size(image_size, self.image_quarter_turns);
        let scale = (max_size.x / rotated_bounds.x)
            .min(max_size.y / rotated_bounds.y)
            .min(1.0);
        let scaled_size = image_size * scale.max(0.0);

        ui.allocate_ui_with_layout(
            max_size,
            Layout::centered_and_justified(egui::Direction::LeftToRight),
            |ui| {
                ui.add(egui::Image::new((texture.id(), scaled_size)).rotate(
                    self.image_quarter_turns as f32 * FRAC_PI_2,
                    egui::Vec2::splat(0.5),
                ));
            },
        );
    }

    fn rotate_counter_clockwise(&mut self) {
        self.image_quarter_turns = (self.image_quarter_turns + 3) % 4;
    }

    fn rotate_clockwise(&mut self) {
        self.image_quarter_turns = (self.image_quarter_turns + 1) % 4;
    }
}

fn modal_title(state: &AttachmentModalState) -> Option<&str> {
    match state {
        AttachmentModalState::Closed => None,
        AttachmentModalState::Pending { attachment }
        | AttachmentModalState::Content { attachment, .. }
        | AttachmentModalState::NotSupported { attachment } => Some(&attachment.name),
    }
}

fn close_icon_button(ui: &mut Ui) -> bool {
    const CLOSE_ICON_SIZE: f32 = 20.0;
    Button::new(RichText::new(icons::regular::X).size(CLOSE_ICON_SIZE))
        .frame(true)
        .frame_when_inactive(false)
        .min_size(vec2(30.0, 30.0))
        .ui(ui)
        .on_hover_cursor(egui::CursorIcon::PointingHand)
        .clicked()
}

fn render_title(title: &str, ui: &mut Ui) {
    Label::new(RichText::new(title).heading()).truncate().ui(ui);
}

fn render_centered_status(size: egui::Vec2, ui: &mut Ui, add_contents: impl FnOnce(&mut egui::Ui)) {
    ui.allocate_ui_with_layout(
        size,
        Layout::centered_and_justified(egui::Direction::LeftToRight),
        add_contents,
    );
}

fn render_content_frame(
    size: egui::Vec2,
    ui: &mut Ui,
    add_contents: impl FnOnce(&mut Ui, egui::Vec2),
) -> Rect {
    let (frame_rect, _) = ui.allocate_exact_size(size, Sense::hover());
    ui.painter().rect_stroke(
        frame_rect,
        4.0,
        ui.visuals().widgets.noninteractive.bg_stroke,
        egui::StrokeKind::Inside,
    );

    let inner_rect = frame_rect.shrink(FRAME_INNER_MARGIN);
    let mut content_ui = ui.new_child(
        UiBuilder::new()
            .max_rect(inner_rect)
            .layout(Layout::top_down(egui::Align::Min)),
    );
    content_ui.set_clip_rect(inner_rect);
    content_ui.set_width(inner_rect.width());
    content_ui.set_height(inner_rect.height());
    add_contents(&mut content_ui, inner_rect.size());

    frame_rect
}

fn render_text(content: &str, attachment_id: Uuid, max_size: egui::Vec2, ui: &mut Ui) {
    egui::ScrollArea::both()
        .id_salt(("attachment-modal-text", attachment_id))
        .auto_shrink([false, false])
        .max_width(max_size.x)
        .max_height(max_size.y)
        .show(ui, |ui| {
            Label::new(RichText::new(content).monospace())
                .selectable(true)
                .extend()
                .ui(ui);
        });
}

fn rotated_size(size: egui::Vec2, quarter_turns: u8) -> egui::Vec2 {
    if quarter_turns.is_multiple_of(2) {
        size
    } else {
        vec2(size.y, size.x)
    }
}

fn render_image_rotation_buttons(ui: &mut Ui, frame_rect: Rect) -> (bool, bool) {
    const ROTATION_BUTTON_SIZE: f32 = 30.0;
    const ROTATION_ICON_SIZE: f32 = 19.0;
    const ROTATION_BUTTON_GAP: f32 = 6.0;

    let total_width = ROTATION_BUTTON_SIZE * 2.0 + ROTATION_BUTTON_GAP;
    let y = frame_rect.top() + FRAME_INNER_MARGIN;
    let counter_rect = Rect::from_min_size(
        pos2(frame_rect.center().x - total_width / 2.0, y),
        vec2(ROTATION_BUTTON_SIZE, ROTATION_BUTTON_SIZE),
    );
    let clockwise_rect = Rect::from_min_size(
        pos2(counter_rect.max.x + ROTATION_BUTTON_GAP, y),
        vec2(ROTATION_BUTTON_SIZE, ROTATION_BUTTON_SIZE),
    );

    let counter_clicked = ui
        .put(
            counter_rect,
            Button::new(
                RichText::new(icons::regular::ARROW_COUNTER_CLOCKWISE).size(ROTATION_ICON_SIZE),
            )
            .frame(true)
            .frame_when_inactive(false),
        )
        .on_hover_cursor(egui::CursorIcon::PointingHand)
        .clicked();
    let clockwise_clicked = ui
        .put(
            clockwise_rect,
            Button::new(RichText::new(icons::regular::ARROW_CLOCKWISE).size(ROTATION_ICON_SIZE))
                .frame(true)
                .frame_when_inactive(false),
        )
        .on_hover_cursor(egui::CursorIcon::PointingHand)
        .clicked();

    (counter_clicked, clockwise_clicked)
}
