use super::{Kind, Manager};
use crate::{
    spawner::{spawn, SpawnResult},
    Target, LOCATION,
};
use async_trait::async_trait;
use futures::future::join_all;
use std::{io, path::PathBuf};

const PATH: &str = "application/apps/rustcore/wasm-bindings";

#[derive(Clone, Debug)]
pub struct Module {}

impl Module {
    pub fn new() -> Self {
        Self {}
    }
}

#[async_trait]
impl Manager for Module {
    fn owner(&self) -> Target {
        Target::Wasm
    }
    fn kind(&self) -> Kind {
        Kind::Rs
    }
    fn cwd(&self) -> PathBuf {
        LOCATION.root.clone().join(PATH)
    }

    fn deps(&self) -> Vec<Target> {
        vec![]
    }

    fn build_cmd(&self, prod: bool) -> Option<String> {
        let env = if prod { "--release" } else { "--dev" };

        Some(format!(
            "wasm-pack build {env} --target bundler --color always"
        ))
    }
}

impl Module {
    // TODO: Use this implementation when testing is implemented in the system
    #[allow(dead_code)]
    pub async fn run_tests(&self) -> Vec<Result<SpawnResult, io::Error>> {
        let path_karma = self.cwd().join("spec");

        join_all([
            spawn(
                "wasm-pack test --node",
                Some(self.cwd()),
                Some("wasm-pack test wasm-bindings"),
            ),
            spawn("npm run test", Some(path_karma), Some("npm test wasm")),
        ])
        .await
    }
}
