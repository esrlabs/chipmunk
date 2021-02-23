extern crate dlt;
extern crate indexer_base;
extern crate neon;
#[macro_use]
extern crate log;
extern crate crossbeam_channel;
extern crate dirs;
extern crate log4rs;
extern crate merging;
extern crate processor;
extern crate serde;

mod channels;
mod config;
mod fibex_utils;
mod js;
mod logging;
use crate::js::session::JsRustSession;
use logging::init_logging;

use neon::prelude::*;

#[no_mangle]
pub extern "C" fn __cxa_pure_virtual() {
    #[allow(clippy::empty_loop)]
    loop {}
}

register_module!(mut cx, {
    init_logging().expect("logging has to be cofigured");

    // API v2.1
    cx.export_class::<JsRustSession>("RustSession")?;

    Ok(())
});
