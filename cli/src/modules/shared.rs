use super::Manager;
use crate::Target;
use async_trait::async_trait;

#[derive(Clone, Debug)]
/// Represents the path `application/platform`
pub struct Module {}

impl Module {
    pub fn new() -> Self {
        Self {}
    }
}

#[async_trait]
impl Manager for Module {
    fn owner(&self) -> Target {
        Target::Shared
    }
}
