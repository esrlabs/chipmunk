use addon::dlt_ft::FtFile;
use dlt_core::filtering::DltFilterConfig;
use node_bindgen::{
    core::{
        val::{JsEnv, JsObject},
        JSValue, NjError,
    },
    sys::napi_value,
};
use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
pub struct WrappedFtFile(FtFile);

impl WrappedFtFile {
    pub fn as_file(&self) -> FtFile {
        self.0.clone()
    }
}

impl JSValue<'_> for WrappedFtFile {
    fn convert_to_rust(env: &JsEnv, n_value: napi_value) -> Result<Self, NjError> {
        if let Ok(js_obj) = env.convert_to_rust::<JsObject>(n_value) {
            let timestamp: Option<u32> = match js_obj.get_property("timestamp") {
                Ok(Some(value)) => match value.as_value() {
                    Ok(val) => Some(val),
                    _ => None,
                },
                Ok(None) => {
                    return Err(NjError::Other(
                        "[timestamp] property is not found".to_owned(),
                    ));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let id: u32 = match js_obj.get_property("id") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other("[id] property is not found".to_owned()));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let name: String = match js_obj.get_property("name") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other("[name] property is not found".to_owned()));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let size: u32 = match js_obj.get_property("size") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other("[size] property is not found".to_owned()));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let created: String = match js_obj.get_property("created") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other("[created] property is not found".to_owned()));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let messages: Vec<u32> = match js_obj.get_property("messages") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other(
                        "[messages] property is not found".to_owned(),
                    ));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let chunks: Vec<(u32, u32)> = match js_obj.get_property("chunks") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other("[chunks] property is not found".to_owned()));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            Ok(WrappedFtFile(FtFile {
                timestamp,
                id,
                name,
                size,
                created,
                messages: messages.iter().map(|m| *m as usize).collect(),
                chunks: chunks
                    .iter()
                    .map(|c| (c.0 as usize, c.1 as usize))
                    .collect(),
            }))
        } else {
            Err(NjError::Other(
                "not valid format (WrappedFtFile)".to_owned(),
            ))
        }
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct FtOptions {
    pub filter_conf: Option<DltFilterConfig>,
    pub with_storage_header: bool,
}
pub struct WrappedDltFilterConfig(DltFilterConfig);

impl WrappedDltFilterConfig {
    pub fn as_config(&self) -> DltFilterConfig {
        self.0.clone()
    }
}

impl JSValue<'_> for WrappedDltFilterConfig {
    fn convert_to_rust(env: &JsEnv, n_value: napi_value) -> Result<Self, NjError> {
        if let Ok(js_obj) = env.convert_to_rust::<JsObject>(n_value) {
            let min_log_level: Option<u8> = match js_obj.get_property("min_log_level") {
                Ok(Some(value)) => match value.as_value::<u32>() {
                    Ok(val) => Some(val as u8),
                    _ => None,
                },
                Ok(None) => None,
                Err(e) => {
                    return Err(e);
                }
            };
            let app_ids: Option<Vec<String>> = match js_obj.get_property("app_ids") {
                Ok(Some(value)) => match value.as_value() {
                    Ok(value) => Some(value),
                    _ => None,
                },
                Ok(None) => {
                    return Err(NjError::Other("[app_ids] property is not found".to_owned()));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let ecu_ids: Option<Vec<String>> = match js_obj.get_property("ecu_ids") {
                Ok(Some(value)) => match value.as_value() {
                    Ok(value) => Some(value),
                    _ => None,
                },
                Ok(None) => {
                    return Err(NjError::Other("[ecu_ids] property is not found".to_owned()));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let context_ids: Option<Vec<String>> = match js_obj.get_property("context_ids") {
                Ok(Some(value)) => match value.as_value() {
                    Ok(value) => Some(value),
                    _ => None,
                },
                Ok(None) => {
                    return Err(NjError::Other(
                        "[context_ids] property is not found".to_owned(),
                    ));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let app_id_count: i64 = match js_obj.get_property("app_id_count") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other(
                        "[app_id_count] property is not found".to_owned(),
                    ));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let context_id_count: i64 = match js_obj.get_property("context_id_count") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other(
                        "[context_id_count] property is not found".to_owned(),
                    ));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            Ok(WrappedDltFilterConfig(DltFilterConfig {
                min_log_level,
                app_ids,
                ecu_ids,
                context_ids,
                app_id_count,
                context_id_count,
            }))
        } else {
            Err(NjError::Other(
                "not valid format (WrappedDltFilterConfig)".to_owned(),
            ))
        }
    }
}

impl JSValue<'_> for FtOptions {
    fn convert_to_rust(env: &JsEnv, n_value: napi_value) -> Result<Self, NjError> {
        if let Ok(js_obj) = env.convert_to_rust::<JsObject>(n_value) {
            let filter_conf: Option<WrappedDltFilterConfig> =
                match js_obj.get_property("filter_config") {
                    Ok(Some(value)) => match value.as_value() {
                        Ok(value) => Some(value),
                        _ => None,
                    },
                    Ok(None) => {
                        return Err(NjError::Other(
                            "[filter_config] property is not found".to_owned(),
                        ));
                    }
                    Err(e) => {
                        return Err(e);
                    }
                };
            let with_storage_header: bool = match js_obj.get_property("with_storage_header") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other(
                        "[with_storage_header] property is not found".to_owned(),
                    ));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            Ok(FtOptions {
                filter_conf: filter_conf.map(|conf| conf.as_config()),
                with_storage_header,
            })
        } else {
            Err(NjError::Other("not valid format (FtOptions)".to_owned()))
        }
    }
}
