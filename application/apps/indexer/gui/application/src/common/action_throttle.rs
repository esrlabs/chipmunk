use std::time::{Duration, Instant};

/// A utility to throttle high-frequency actions (like scrolling or zooming)
/// that trigger expensive operations (like backend blocking commands).
///
/// # Behavior
///
/// * **Leading Edge:** The first action is always allowed immediately.
/// * **Interval:** Subsequent actions are blocked until the `interval` has elapsed.
/// * **Tail Handling:** If an action is blocked and an `egui::Context` is provided,
///   it schedules a repaint for exactly when the timer expires. This ensures the
///   final state of a drag/scroll operation is processed even if the user stops input.
#[derive(Debug)]
pub struct ActionThrottle {
    last_action: Instant,
    interval: Duration,
}

impl ActionThrottle {
    /// Creates a new throttler with the specified cool-down interval.
    pub fn new(interval: Duration) -> Self {
        Self {
            // Initialize in the past so the first action always works immediately.
            last_action: Instant::now()
                .checked_sub(interval)
                .unwrap_or_else(Instant::now),
            interval,
        }
    }

    /// Checks if the action is allowed to proceed.
    ///
    /// # Arguments
    ///
    /// * `ctx` - Optional `egui::Context`. If provided, and the action is throttled,
    ///   a repaint will be requested for the remaining duration. This is needed for
    ///   handling the "tail" of scroll/zoom events.
    ///
    /// # Returns
    ///
    /// * `true` - The interval has passed. The timer is reset, and the action should proceed.
    /// * `false` - The interval has not passed. The action should be skipped.
    pub fn ready(&mut self, ctx: Option<&egui::Context>) -> bool {
        let elapsed = self.last_action.elapsed();

        if elapsed >= self.interval {
            self.last_action = Instant::now();
            return true;
        }

        // Ensure we wake up exactly when the cool-down finishes to process final state.
        if let Some(ctx) = ctx {
            let remaining = self.interval - elapsed;
            ctx.request_repaint_after(remaining);
        }

        false
    }

    /// Resets the throttle, allowing the very next call to `ready()` to return true.
    pub fn reset(&mut self) {
        // Set last_action to the past to ensure immediate trigger.
        self.last_action = Instant::now()
            .checked_sub(self.interval)
            .unwrap_or_else(Instant::now);
    }
}
