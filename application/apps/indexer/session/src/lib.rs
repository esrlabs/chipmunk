mod handlers;
pub mod operations;
pub mod paths;
pub mod progress;
pub mod session;
pub mod state;
pub mod tail;
pub mod tracker;
pub mod unbound;

use std::{env, sync::Mutex, time::Instant};
use tokio::sync::mpsc;

extern crate lazy_static;

lazy_static::lazy_static! {
    pub static ref TRACKER_CHANNEL: Mutex<(
        mpsc::UnboundedSender<stypes::LifecycleTransition>,
        Option<mpsc::UnboundedReceiver<stypes::LifecycleTransition>>
    )> = {
        let (tx, rx) = mpsc::unbounded_channel();
        Mutex::new((tx, Some(rx)))
    };
}

/// A Timer that can be used to monitor performance in dev-mode.
struct Timer<'a> {
    what: &'a str,
    start: Option<Instant>,
}

impl<'a> Timer<'a> {
    /// Creates a new timer.
    fn new(what: &'a str) -> Self {
        Timer {
            what,
            start: if env::var("CHIPMUNK_DEVELOPING_MODE").is_ok() {
                Some(std::time::Instant::now())
            } else {
                None
            },
        }
    }

    /// Prints timer result to console if dev-mode is on.
    fn done(&mut self) {
        if let Some(time) = self.start {
            println!("🕑 {} took: {:?}", self.what, time.elapsed());
            self.start = None;
        }
    }
}
