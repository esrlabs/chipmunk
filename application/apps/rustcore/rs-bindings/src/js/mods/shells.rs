use envvars::{get_context_envvars, get_profiles};
use node_bindgen::derive::node_bindgen;
use serde_json;

#[node_bindgen]
struct Shells {}

#[node_bindgen]
impl Shells {
    #[node_bindgen(constructor)]
    fn new() -> Self {
        Shells {}
    }

    #[node_bindgen]
    async fn get_valid_profiles(&self) -> Result<String, String> {
        let mut profiles = get_profiles().map_err(|e| e.to_string())?;
        for profile in &mut profiles {
            if let Err(e) = profile.load() {
                log::warn!("Fail to load envvars for \"{}\": {e}", profile.name);
            }
        }
        serde_json::to_string(&profiles).map_err(|e| e.to_string())
    }

    #[node_bindgen]
    async fn get_context_envvars(&self) -> Result<String, String> {
        let envvars = get_context_envvars().map_err(|e| e.to_string())?;
        serde_json::to_string(&envvars).map_err(|e| e.to_string())
    }
}
