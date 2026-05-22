//! Recent-session storage domain.
//!
//! This module exposes the host UI's recent-session model and the in-memory
//! storage state used to load, mutate, and save that data.

pub mod session;
pub mod source_key;
pub mod storage;
pub mod validation;
