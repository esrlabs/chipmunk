//! Frame-based visibility transition tracking for immediate-mode UI.
//!
//! In egui a widget does not have a retained visibility lifecycle. If a branch is not rendered in
//! a frame, the widget simply does not exist for that frame. `VisibilityTracker` stores the last
//! frame in which a caller marked something as visible and reports when that thing becomes visible
//! again.

use egui::Ui;

/// Tracks whether something is visible in consecutive egui frames.
///
/// Call [`Self::is_newly_visible`] exactly once in each frame where the tracked thing is actually
/// rendered. The method returns `true` on the first observed frame and again after one or more
/// frames where it was not marked visible.
///
/// This is useful for one-shot UI work tied to visibility transitions, such as requesting focus,
/// resetting transient animation state, or scrolling an item into view.
#[derive(Debug, Clone, Default)]
pub struct VisibilityTracker {
    last_visible_frame: Option<u64>,
}

impl VisibilityTracker {
    /// Marks the tracked thing as visible in the current frame.
    ///
    /// Returns `true` when this is the first visible frame observed by the tracker, or when one or
    /// more egui frames elapsed since the previous visible frame.
    ///
    /// The tracker only knows about frames where this method is called. If a widget is rendered in
    /// every frame, this returns `true` once and then `false` in subsequent frames. If rendering is
    /// skipped for at least one frame, the next call returns `true` again.
    pub fn is_newly_visible(&mut self, ui: &Ui) -> bool {
        let frame_nr = ui.cumulative_frame_nr();
        // First time the item is rendered is count as newly visible as well.
        let is_newly_visible = self
            .last_visible_frame
            .is_none_or(|last_visible_frame| last_visible_frame.saturating_add(1) < frame_nr);

        self.last_visible_frame = Some(frame_nr);
        is_newly_visible
    }
}

#[cfg(test)]
mod tests {
    use super::VisibilityTracker;

    #[test]
    fn returns_true_on_first_visible_frame() {
        let mut tracker = VisibilityTracker::default();
        let ctx = egui::Context::default();

        let _ = ctx.run_ui(Default::default(), |ui| {
            assert!(tracker.is_newly_visible(ui));
        });
    }

    #[test]
    fn returns_false_while_visibility_is_continuous() {
        let mut tracker = VisibilityTracker::default();
        let ctx = egui::Context::default();

        let _ = ctx.run_ui(Default::default(), |ui| {
            assert!(tracker.is_newly_visible(ui));
        });
        let _ = ctx.run_ui(Default::default(), |ui| {
            assert!(!tracker.is_newly_visible(ui));
        });
    }

    #[test]
    fn returns_true_after_visibility_gap() {
        let mut tracker = VisibilityTracker::default();
        let ctx = egui::Context::default();

        let _ = ctx.run_ui(Default::default(), |ui| {
            assert!(tracker.is_newly_visible(ui));
        });
        let _ = ctx.run_ui(Default::default(), |_| {});
        let _ = ctx.run_ui(Default::default(), |ui| {
            assert!(tracker.is_newly_visible(ui));
        });
    }
}
