use command_outcome::Cancelled;
use node_bindgen::{
    core::{safebuffer::SafeArrayBuffer, val::JsEnv, NjError, TryIntoJs},
    sys::napi_value,
};
use output::{Empty, StringVec};
use proto::*;
use session::unbound::commands::CommandOutcome;

pub(crate) struct CommandOutcomeWrapper<T>(pub Option<CommandOutcome<T>>);

impl<T> CommandOutcomeWrapper<T> {
    pub fn new(val: CommandOutcome<T>) -> Self {
        CommandOutcomeWrapper(Some(val))
    }
}

fn get<T>(mut output: Option<CommandOutcome<T>>) -> Option<T> {
    match output.take().expect("Command output has to be provided") {
        CommandOutcome::Finished(output) => Some(output),
        CommandOutcome::Cancelled => None,
    }
}

impl From<CommandOutcomeWrapper<String>> for Vec<u8> {
    fn from(output: CommandOutcomeWrapper<String>) -> Self {
        let msg = get(output.0)
            .map(|v| proto::CommandOutcome {
                outcome: Some(command_outcome::Outcome::Finished(
                    command_outcome::Finished {
                        result: Some(Output {
                            output: Some(output::Output::StringValue(v)),
                        }),
                    },
                )),
            })
            .unwrap_or_else(|| proto::CommandOutcome {
                outcome: Some(command_outcome::Outcome::Cancelled(Cancelled {})),
            });
        prost::Message::encode_to_vec(&msg)
    }
}

impl From<CommandOutcomeWrapper<Option<String>>> for Vec<u8> {
    fn from(output: CommandOutcomeWrapper<Option<String>>) -> Self {
        let msg = get(output.0)
            .map(|v| proto::CommandOutcome {
                outcome: Some(command_outcome::Outcome::Finished(
                    command_outcome::Finished {
                        result: Some(Output {
                            output: Some(output::Output::OptionStringValue(v.unwrap_or_default())),
                        }),
                    },
                )),
            })
            .unwrap_or_else(|| proto::CommandOutcome {
                outcome: Some(command_outcome::Outcome::Cancelled(Cancelled {})),
            });
        prost::Message::encode_to_vec(&msg)
    }
}

impl From<CommandOutcomeWrapper<Vec<String>>> for Vec<u8> {
    fn from(output: CommandOutcomeWrapper<Vec<String>>) -> Self {
        let msg = get(output.0)
            .map(|values| proto::CommandOutcome {
                outcome: Some(command_outcome::Outcome::Finished(
                    command_outcome::Finished {
                        result: Some(Output {
                            output: Some(output::Output::StringVecValue(StringVec { values })),
                        }),
                    },
                )),
            })
            .unwrap_or_else(|| proto::CommandOutcome {
                outcome: Some(command_outcome::Outcome::Cancelled(Cancelled {})),
            });
        prost::Message::encode_to_vec(&msg)
    }
}

impl From<CommandOutcomeWrapper<bool>> for Vec<u8> {
    fn from(output: CommandOutcomeWrapper<bool>) -> Self {
        let msg = get(output.0)
            .map(|v| proto::CommandOutcome {
                outcome: Some(command_outcome::Outcome::Finished(
                    command_outcome::Finished {
                        result: Some(Output {
                            output: Some(output::Output::BoolValue(v)),
                        }),
                    },
                )),
            })
            .unwrap_or_else(|| proto::CommandOutcome {
                outcome: Some(command_outcome::Outcome::Cancelled(Cancelled {})),
            });
        prost::Message::encode_to_vec(&msg)
    }
}

impl From<CommandOutcomeWrapper<()>> for Vec<u8> {
    fn from(output: CommandOutcomeWrapper<()>) -> Self {
        let msg = get(output.0)
            .map(|_| proto::CommandOutcome {
                outcome: Some(command_outcome::Outcome::Finished(
                    command_outcome::Finished {
                        result: Some(Output {
                            output: Some(output::Output::EmptyValue(Empty {})),
                        }),
                    },
                )),
            })
            .unwrap_or_else(|| proto::CommandOutcome {
                outcome: Some(command_outcome::Outcome::Cancelled(Cancelled {})),
            });
        prost::Message::encode_to_vec(&msg)
    }
}

impl From<CommandOutcomeWrapper<i64>> for Vec<u8> {
    fn from(output: CommandOutcomeWrapper<i64>) -> Self {
        let msg = get(output.0)
            .map(|v| proto::CommandOutcome {
                outcome: Some(command_outcome::Outcome::Finished(
                    command_outcome::Finished {
                        result: Some(Output {
                            output: Some(output::Output::Int64Value(v)),
                        }),
                    },
                )),
            })
            .unwrap_or_else(|| proto::CommandOutcome {
                outcome: Some(command_outcome::Outcome::Cancelled(Cancelled {})),
            });
        prost::Message::encode_to_vec(&msg)
    }
}

impl TryIntoJs for CommandOutcomeWrapper<String> {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        SafeArrayBuffer::new(self.into()).try_to_js(js_env)
    }
}

impl TryIntoJs for CommandOutcomeWrapper<i64> {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        SafeArrayBuffer::new(self.into()).try_to_js(js_env)
    }
}

impl TryIntoJs for CommandOutcomeWrapper<()> {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        SafeArrayBuffer::new(self.into()).try_to_js(js_env)
    }
}

impl TryIntoJs for CommandOutcomeWrapper<bool> {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        SafeArrayBuffer::new(self.into()).try_to_js(js_env)
    }
}

impl TryIntoJs for CommandOutcomeWrapper<Vec<String>> {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        SafeArrayBuffer::new(self.into()).try_to_js(js_env)
    }
}

impl TryIntoJs for CommandOutcomeWrapper<Option<String>> {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        SafeArrayBuffer::new(self.into()).try_to_js(js_env)
    }
}
