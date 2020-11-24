use crate::js::event_handler::*;
use neon::prelude::*;
mod js {
    pub mod event_handler;
}

register_module!(mut cx, {
    cx.export_class::<JsGrabberHolder>("GrabberHolder")?;
    Ok(())
});
