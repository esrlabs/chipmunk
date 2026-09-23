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
    /// `None` until the first allowed action, making the leading edge pass immediately.
    last_action: Option<Instant>,
    interval: Duration,
}

impl ActionThrottle {
    /// Creates a new throttler with the specified cool-down interval.
    pub fn new(interval: Duration) -> Self {
        Self {
            last_action: None,
            interval,
        }
    }

    /// Checks if the action is allowed to proceed.
    ///
    /// # Arguments
    ///
    /// * `now` - Current timestamp, provided by the caller to avoid a clock call per frame.
    /// * `ctx` - Optional `egui::Context`. If provided, and the action is throttled,
    ///   a repaint will be requested for the remaining duration. This is needed for
    ///   handling the "tail" of scroll/zoom events.
    ///
    /// # Returns
    ///
    /// * `true` - The interval has passed. The timer is reset, and the action should proceed.
    /// * `false` - The interval has not passed. The action should be skipped.
    pub fn ready(&mut self, now: Instant, ctx: Option<&egui::Context>) -> bool {
        let remaining = self.remaining(now);

        if remaining.is_zero() {
            self.last_action = Some(now);
            return true;
        }

        // Ensure we wake up exactly when the cool-down finishes to process final state.
        if let Some(ctx) = ctx {
            ctx.request_repaint_after(remaining);
        }

        false
    }

    /// Delays the next action until the full interval has elapsed.
    pub fn delay_next(&mut self, now: Instant) {
        self.last_action = Some(now);
    }

    /// Resets the throttle, allowing the very next call to `ready()` to return true.
    pub fn reset(&mut self) {
        self.last_action = None;
    }

    /// Returns the cool-down left before the next action is allowed.
    fn remaining(&self, now: Instant) -> Duration {
        let Some(last_action) = self.last_action else {
            return Duration::ZERO;
        };

        self.interval
            .saturating_sub(now.saturating_duration_since(last_action))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const INTERVAL: Duration = Duration::from_millis(100);

    #[test]
    fn test_throttle_leading_edge() {
        let mut throttle = ActionThrottle::new(INTERVAL);
        // First call should always be ready
        assert!(throttle.ready(Instant::now(), None));
    }

    #[test]
    fn test_throttle_blocking() {
        let mut throttle = ActionThrottle::new(INTERVAL);
        let now = Instant::now();

        assert!(throttle.ready(now, None));
        // Immediate second call should be blocked
        assert!(!throttle.ready(now, None));
    }

    #[test]
    fn test_throttle_wait() {
        let mut throttle = ActionThrottle::new(INTERVAL);
        let now = Instant::now();

        assert!(throttle.ready(now, None));
        assert!(!throttle.ready(now, None));
        assert!(!throttle.ready(now + INTERVAL / 2, None));
        assert!(throttle.ready(now + INTERVAL, None));
    }

    #[test]
    fn test_throttle_delay_next() {
        let mut throttle = ActionThrottle::new(INTERVAL);
        let now = Instant::now();

        throttle.delay_next(now);
        assert!(!throttle.ready(now, None));
        assert!(throttle.ready(now + INTERVAL, None));
    }

    #[test]
    fn test_throttle_reset() {
        let mut throttle = ActionThrottle::new(INTERVAL);
        let now = Instant::now();

        assert!(throttle.ready(now, None));
        assert!(!throttle.ready(now, None));

        throttle.reset();
        // Should be ready immediately after reset
        assert!(throttle.ready(now, None));
    }
}
