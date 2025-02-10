//! Provides shared types to be used among all other plugins.

pub mod config;
pub mod logging;
pub mod plugin_logger;

wit_bindgen::generate!({
    path: "wit/v0.1.0",
    world: "chipmunk:shared/bindings",
    generate_unused_types: true,
});

use crate::shared_types::{ConfigSchemaItem, ConfigSchemaType, Version};

impl ConfigSchemaItem {
    /// Creates a new configuration schema item with the given arguments
    pub fn new<S: Into<String>>(
        id: S,
        title: S,
        description: Option<S>,
        input_type: ConfigSchemaType,
    ) -> Self {
        Self {
            id: id.into(),
            title: title.into(),
            description: description.map(|d| d.into()),
            input_type,
        }
    }
}

impl Version {
    /// Creates a semantic version instance with the given arguments.
    pub fn new(major: u16, minor: u16, patch: u16) -> Self {
        Self {
            major,
            minor,
            patch,
        }
    }
}
