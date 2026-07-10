//! Latest notification banner rendering.

use std::time::{Duration, Instant};

use egui::{
    Align2, Area, Color32, Frame, Id, Label, Margin, NumExt, Order, Rect, RichText, Sense, Stroke,
    TextWrapMode, Ui, Vec2, pos2,
};

use super::NotificationEntry;

/// State for the currently visible temporal notification banner.
#[derive(Debug, Clone)]
pub struct NotificationBanner {
    entry: NotificationEntry,
    remaining: Duration,
    created_at: Instant,
    last_updated: Instant,
    // The banner uses a stable egui Area id, so egui keeps the previous Area size.
    // When true, the next render uses a sizing pass to drop stale cached height.
    reset_cached_size: bool,
}

impl NotificationBanner {
    pub fn new(entry: NotificationEntry) -> Self {
        const BANNER_TTL: Duration = Duration::from_secs(4);

        let now = Instant::now();
        Self {
            entry,
            remaining: BANNER_TTL,
            created_at: now,
            last_updated: now,
            reset_cached_size: true,
        }
    }

    pub fn render(&mut self, button_rect: Rect, ui: &mut Ui) -> bool {
        const BANNER_MAX_WIDTH: f32 = 340.0;
        const BANNER_MARGIN: f32 = 8.0;
        const BANNER_GAP: f32 = 6.0;

        let content_rect = ui.ctx().content_rect();
        let available_width = content_rect.width() - BANNER_MARGIN * 2.0;
        let banner_width = BANNER_MAX_WIDTH.min(available_width.at_least(20.0));
        let pos = pos2(
            button_rect
                .right()
                .min(content_rect.right() - BANNER_MARGIN),
            button_rect.bottom() + BANNER_GAP,
        );

        let now = Instant::now();
        const FADE_IN: Duration = Duration::from_millis(120);
        const FADE_OUT: Duration = Duration::from_millis(400);
        let age_alpha = (now.saturating_duration_since(self.created_at).as_secs_f32()
            / FADE_IN.as_secs_f32())
        .clamp(0.0, 1.0);
        let remaining_alpha =
            (self.remaining.as_secs_f32() / FADE_OUT.as_secs_f32()).clamp(0.0, 1.0);
        let opacity = age_alpha.min(remaining_alpha);
        let apply_alpha = |color: Color32| {
            let alpha = (color.a() as f32 * opacity).round() as u8;
            Color32::from_rgba_unmultiplied(color.r(), color.g(), color.b(), alpha)
        };

        let entry = &self.entry;
        let banner_id = Id::new("notification_banner");
        let response = Area::new(banner_id)
            .order(Order::Foreground)
            .pivot(Align2::RIGHT_TOP)
            .fixed_pos(pos)
            // Reset egui's cached Area size when a new notification replaces the old one.
            .sizing_pass(self.reset_cached_size)
            .show(ui.ctx(), |ui| {
                ui.set_width(banner_width);

                let base_level_color = entry.level.color(ui.visuals().dark_mode);
                let level_color = apply_alpha(base_level_color);
                let stroke = Stroke::new(1.0_f32, level_color);
                let margin = Margin::same(10);
                let content_width = (banner_width - 20.0).at_least(0.0);
                let text_color = apply_alpha(ui.visuals().text_color());
                let mut frame = Frame::window(ui.style())
                    .stroke(stroke)
                    .inner_margin(margin);
                frame.fill = apply_alpha(frame.fill);
                frame.shadow.color = apply_alpha(frame.shadow.color);
                frame
                    .show(ui, |ui| {
                        ui.set_min_width(content_width);
                        ui.horizontal_centered(|ui| {
                            let dot_size = Vec2::splat(8.0);
                            let (respond, painter) = ui.allocate_painter(dot_size, Sense::empty());
                            let dot_radius = respond.rect.width() / 2.0;
                            painter.circle_filled(respond.rect.center(), dot_radius, level_color);

                            let message =
                                Label::new(RichText::new(&entry.message).color(text_color))
                                    .wrap_mode(TextWrapMode::Wrap);
                            ui.add(message);
                        });
                    })
                    .response
                    .interact(Sense::click())
            })
            .inner;
        self.reset_cached_size = false;

        if response.clicked() {
            return true;
        }

        let hovered = response.hovered()
            || ui
                .ctx()
                .rect_contains_pointer(response.layer_id, response.interact_rect);
        if hovered {
            self.last_updated = now;
        } else {
            let elapsed = now.saturating_duration_since(self.last_updated);
            self.last_updated = now;
            self.remaining = self.remaining.saturating_sub(elapsed);
        }

        if !self.expired() {
            // Some platforms do not reliably wake the app for delayed repaints here.
            // Keep the repaint loop alive only while a banner is visible.
            ui.ctx().request_repaint();
        }

        false
    }

    pub fn expired(&self) -> bool {
        self.remaining.is_zero()
    }
}
