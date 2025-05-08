// Rust can't currently distinguish between dev and none-dev dependencies at the moment. There is
// an open issue for this case: "https://github.com/rust-lang/rust/issues/129637"
#[macro_use]
extern crate lazy_static;

#[macro_use]
extern crate log;

#[cfg(test)]
mod tests;

pub mod binary;
pub mod command;
pub mod prelude;
pub mod producer;
pub mod sde;
pub mod serial;
pub mod socket;
