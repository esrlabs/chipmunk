//! Recent-session storage domain.
//!
//! This module exposes the host UI's recent-session model and the in-memory
//! storage state used to load, mutate, and save that data.

mod session;
mod source_key;
mod storage;

pub use session::{
    RecentSessionRegistration, RecentSessionReopenMode, RecentSessionSnapshot, RecentSessionSource,
    RecentSessionStateSnapshot, SearchFilterSnapshot,
};
pub use storage::{MAX_RECENT_SESSIONS, RecentSessionsStorage};
