//! Contains useful functions around the configurations of the plugins and their validations.

use crate::shared_types::{ConfigItem, ConfigValue, InitError};

/// Macro to generate getter functions for [`ConfigValue`] types, returning an owned value.
macro_rules! generate_get_config_function_owned {
    ($fn: ident, $typ:ty, $conf_typ:path) => {
        /// Provides the corresponding value with the given [`config_id`] from the given
        /// [`plugins_configs`]
        ///
        /// # Arguments:
        /// * `config_id`: The ID of the configuration items.
        /// * `plugins_configs`: All the provided configuration items.
        ///
        /// # Returns:
        /// This function returns the corresponding config value if the the provided [`config_id`]
        /// exists in the provided [`plugins_configs`] and have a matching value type.
        /// Otherwise it will return an [`InitError::Config`] with the matching error message.
        pub fn $fn(config_id: &str, plugins_configs: &[ConfigItem]) -> Result<$typ, InitError> {
            let prefix_config_item = plugins_configs
                .iter()
                .find(|item| item.id == config_id)
                .ok_or_else(|| {
                    InitError::Config(format!(
                        "No configuration value for id '{config_id}' is provided"
                    ))
                })?;

            match &prefix_config_item.value {
                $conf_typ(val) => Ok(val.to_owned()),
                invalid => {
                    let err_msg =
                        format!("Invalid config value for '{config_id}' is provided. Value: {invalid:?}");
                    return Err(InitError::Config(err_msg));
                }
            }
        }
    };
}

/// Macro to generate getter functions for [`ConfigValue`] types, returning a borrowed value.
macro_rules! generate_get_config_function_borrow {
    ($fn: ident, $typ:ty, $conf_typ:path) => {
        /// Provides the corresponding value with the given [`config_id`] from the given
        /// [`plugins_configs`]
        ///
        /// # Arguments:
        /// * `config_id`: The ID of the configuration items.
        /// * `plugins_configs`: All the provided configuration items.
        ///
        /// # Returns:
        /// This function returns the corresponding config value if the the provided [`config_id`]
        /// exists in the provided [`plugins_configs`] and have a matching value type.
        /// Otherwise it will return an [`InitError::Config`] with the matching error message.
        pub fn $fn<'a>(config_id: &str, plugins_configs: &'a [ConfigItem]) -> Result<&'a $typ, InitError> {
            let prefix_config_item = plugins_configs
                .iter()
                .find(|item| item.id == config_id)
                .ok_or_else(|| {
                    InitError::Config(format!(
                        "No configuration value for id '{config_id}' is provided"
                    ))
                })?;

            match &prefix_config_item.value {
                $conf_typ(val) => Ok(val),
                invalid => {
                    let err_msg =
                        format!("Invalid config value for '{config_id}' is provided. Value: {invalid:?}");
                    return Err(InitError::Config(err_msg));
                }
            }
        }
    };
}

generate_get_config_function_owned!(get_as_boolean, bool, ConfigValue::Boolean);
generate_get_config_function_owned!(get_as_integer, i32, ConfigValue::Integer);
generate_get_config_function_owned!(get_as_float, f32, ConfigValue::Float);
generate_get_config_function_borrow!(get_as_text, str, ConfigValue::Text);
generate_get_config_function_borrow!(get_as_directories, [String], ConfigValue::Directories);
generate_get_config_function_borrow!(get_as_files, [String], ConfigValue::Files);
generate_get_config_function_borrow!(get_as_dropdown, str, ConfigValue::Dropdown);

#[cfg(debug_assertions)]
/// This function is a reminder to get compiler errors on changes in [`ConfigValue`] type.
fn _ensure_all_have_functions() {
    // Reminder to ensure that all configuration values have corresponding get function.
    match ConfigValue::Boolean(true) {
        ConfigValue::Boolean(_) => _ = get_as_boolean("", &[]),
        ConfigValue::Integer(_) => _ = get_as_integer("", &[]),
        ConfigValue::Float(_) => _ = get_as_float("", &[]),
        ConfigValue::Text(_) => _ = get_as_text("", &[]),
        ConfigValue::Directories(_) => _ = get_as_directories("", &[]),
        ConfigValue::Files(_) => _ = get_as_files("", &[]),
        ConfigValue::Dropdown(_) => _ = get_as_dropdown("", &[]),
    }
}
