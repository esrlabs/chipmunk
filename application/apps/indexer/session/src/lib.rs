mod handlers;
pub mod mcp_api;
pub mod operations;
pub mod paths;
pub mod progress;
pub mod session;
pub mod state;
pub mod tail;
pub mod tracker;
pub mod unbound;

use std::sync::Mutex;
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
