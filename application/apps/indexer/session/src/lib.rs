#![deny(unused_crate_dependencies)]
pub mod events;
mod handlers;
pub mod operations;
pub mod paths;
pub mod progress;
pub mod session;
pub mod state;
pub mod tail;
pub mod tracker;
pub mod unbound;

use std::sync::Mutex;

pub use sources::factory;
use tokio::sync::mpsc;

use crate::events::LifecycleTransition;

extern crate lazy_static;

lazy_static::lazy_static! {
    pub static ref TRACKER_CHANNEL: Mutex<(
        mpsc::UnboundedSender<LifecycleTransition>,
        Option<mpsc::UnboundedReceiver<LifecycleTransition>>
    )> = {
        let (tx, rx) = mpsc::unbounded_channel();
        Mutex::new((tx, Some(rx)))
    };
}
