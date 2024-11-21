use node_bindgen::{
    core::{safebuffer::SafeArrayBuffer, val::JsEnv, NjError, TryIntoJs},
    sys::napi_value,
};
use progress::{self, lifecycle_transition};
use proto::*;
use session::{
    events::{LifecycleTransition, LifecycleTransitionId},
    progress::Ticks,
};
use uuid::Uuid;

#[derive(Debug)]
pub(crate) struct LifecycleTransitionWrapped(Option<LifecycleTransition>);

impl LifecycleTransitionWrapped {
    pub fn new(lt: LifecycleTransition) -> Self {
        LifecycleTransitionWrapped(Some(lt))
    }
}

impl From<LifecycleTransition> for LifecycleTransitionWrapped {
    fn from(ev: LifecycleTransition) -> LifecycleTransitionWrapped {
        LifecycleTransitionWrapped::new(ev)
    }
}

impl From<LifecycleTransitionWrapped> for Vec<u8> {
    fn from(mut val: LifecycleTransitionWrapped) -> Self {
        let ev = val
            .0
            .take()
            .expect("LifecycleTransition has to be provided");
        let msg = progress::LifecycleTransition {
            transition_oneof: Some(match ev {
                LifecycleTransition::Started { uuid, alias } => {
                    lifecycle_transition::TransitionOneof::Started(progress::Started {
                        uuid: uuid.to_string(),
                        alias,
                    })
                }
                LifecycleTransition::Stopped(uuid) => {
                    lifecycle_transition::TransitionOneof::Stopped(progress::Stopped {
                        uuid: uuid.to_string(),
                    })
                }
                LifecycleTransition::Ticks { uuid, ticks } => {
                    lifecycle_transition::TransitionOneof::Ticks(progress::TicksWithUuid {
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

impl TryIntoJs for LifecycleTransitionWrapped {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        SafeArrayBuffer::new(self.into()).try_to_js(js_env)
    }
}

pub fn test_cases() -> Vec<LifecycleTransitionWrapped> {
    let events: Vec<LifecycleTransition> = LifecycleTransitionId::as_vec()
        .into_iter()
        .flat_map(|id| match id {
            LifecycleTransitionId::Started => vec![
                LifecycleTransition::Started {
                    uuid: Uuid::new_v4(),
                    alias: String::from("test"),
                },
                LifecycleTransition::Started {
                    uuid: Uuid::new_v4(),
                    alias: String::new(),
                },
            ],
            LifecycleTransitionId::Stopped => vec![LifecycleTransition::Stopped(Uuid::new_v4())],
            LifecycleTransitionId::Ticks => vec![
                LifecycleTransition::Ticks {
                    uuid: Uuid::new_v4(),
                    ticks: Ticks {
                        count: 1,
                        state: Some(String::from("test")),
                        total: Some(100),
                    },
                },
                LifecycleTransition::Ticks {
                    uuid: Uuid::new_v4(),
                    ticks: Ticks {
                        count: 0,
                        state: Some(String::new()),
                        total: Some(0),
                    },
                },
                LifecycleTransition::Ticks {
                    uuid: Uuid::new_v4(),
                    ticks: Ticks {
                        count: 0,
                        state: None,
                        total: None,
                    },
                },
            ],
        })
        .collect();
    events.into_iter().map(|ev| ev.into()).collect()
}
