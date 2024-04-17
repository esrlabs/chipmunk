use std::{collections::HashMap, sync::Mutex};

use tokio::sync::{oneshot, OnceCell};

use crate::{spawner::SpawnResult, target::Target};

type BuildResult = Result<Vec<SpawnResult>, anyhow::Error>;

pub enum BuildState {
    Running(Vec<oneshot::Sender<BuildResult>>),
    Finished(BuildResult),
}

pub struct BuildStatesTracker {
    pub states_map: Mutex<HashMap<Target, BuildState>>,
}

impl BuildStatesTracker {
    fn new() -> Self {
        let states_map = Mutex::new(HashMap::new());
        Self { states_map }
    }

    pub async fn get() -> &'static BuildStatesTracker {
        static BUILD_STATES: OnceCell<BuildStatesTracker> = OnceCell::const_new();

        BUILD_STATES
            .get_or_init(|| async { BuildStatesTracker::new() })
            .await
    }
}
