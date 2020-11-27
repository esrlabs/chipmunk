use crate::js::event_handler::*;
use crate::js::events::*;
use crate::test::computation_mock::JsSession;
use logging::init_logging;
use neon::prelude::*;

mod js {
    pub mod event_handler;
    pub mod events;
}
mod test {
    pub mod computation_mock;
}
mod logging;

register_module!(mut cx, {
    init_logging().expect("logging has to be cofigured");
    let progress_value = cx.string(CallbackEvent::Progress.to_string());
    let notification_value = cx.string(CallbackEvent::Notification.to_string());
    let done_value = cx.string(CallbackEvent::Done.to_string());

    cx.export_value("PROGRESS", progress_value)?;
    cx.export_value("NOTIFICATION", notification_value)?;
    cx.export_value("DONE", done_value)?;
    cx.export_class::<JsGrabberHolder>("GrabberHolder")?;
    cx.export_class::<JsSession>("ComputationMock")?;
    Ok(())
});
