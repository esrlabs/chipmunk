//! Shared log-table infrastructure.
//!
//! Main logs and search results render through separate table delegates, but
//! they share row mechanics, column persistence, selection behavior, and log
//! cell text layout. This module groups those shared pieces without making the
//! search table depend on the main log table module.

pub mod table;
pub mod text;
