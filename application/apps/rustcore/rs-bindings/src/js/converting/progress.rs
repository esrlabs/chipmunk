use node_bindgen::{
    core::{safebuffer::SafeArrayBuffer, val::JsEnv, NjError, TryIntoJs},
    sys::napi_value,
};
use progress::{self, lifecycle_transition};
use proto::*;
use session::events::LifecycleTransition;

#[derive(Debug)]
pub(crate) struct LifecycleTransitionWrapper(Option<LifecycleTransition>);

impl LifecycleTransitionWrapper {
    pub fn new(lt: LifecycleTransition) -> Self {
        LifecycleTransitionWrapper(Some(lt))
    }
}

impl From<LifecycleTransitionWrapper> for Vec<u8> {
    fn from(mut val: LifecycleTransitionWrapper) -> Self {
        let ev = val
            .0
            .take()
            .expect("LifecycleTransition has to be provided");
        let msg = progress::LifecycleTransition {
            transition: Some(match ev {
                LifecycleTransition::Started { uuid, alias } => {
                    lifecycle_transition::Transition::Started(progress::Started {
                        uuid: uuid.to_string(),
                        alias,
                    })
                }
                LifecycleTransition::Stopped(uuid) => {
                    lifecycle_transition::Transition::Stopped(progress::Stopped {
                        uuid: uuid.to_string(),
                    })
                }
                LifecycleTransition::Ticks { uuid, ticks } => {
                    lifecycle_transition::Transition::Ticks(progress::TicksWithUuid {
                        uuid: uuid.to_string(),
                        ticks: Some(progress::Ticks {
                            count: ticks.count,
                            state: ticks.state.unwrap_or_default(),
                            total: ticks.total.unwrap_or_default(),
                        }),
                    })
                }
            }),
        };
        prost::Message::encode_to_vec(&msg)
    }
}

impl TryIntoJs for LifecycleTransitionWrapper {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        SafeArrayBuffer::new(self.into()).try_to_js(js_env)
    }
}
