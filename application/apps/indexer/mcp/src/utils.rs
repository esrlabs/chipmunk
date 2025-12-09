use std::path::PathBuf;

pub const CHIPMUNK_HOME: &str = ".chipmunk";
pub const SETTINGS_HOME: &str = "settings";
pub const AI_CONFIG_FILE: &str = "ai_config.json";

/// Provide path for Chipmunk home directory.
pub fn get_chipmunk_home_dir() -> Option<PathBuf> {
    #[cfg(not(test))]
    {
        dirs::home_dir().map(|home| home.join(CHIPMUNK_HOME))
    }

    #[cfg(test)]
    {
        use tempfile::tempdir;

        tempdir()
            .map(|tempdir| tempdir.keep())
            .ok()
            .or(Some(PathBuf::from("/tmp")))
            .map(|d| d.join(CHIPMUNK_HOME))
    }
}

/// Returns the chipmunk config file path.
pub fn get_chipmunk_config() -> Option<PathBuf> {
    get_chipmunk_home_dir().map(|home| home.join(SETTINGS_HOME).join(AI_CONFIG_FILE))
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::*;

    #[test]
    fn test_get_chipmunk_home_dir() {
        let home_dir = get_chipmunk_home_dir();
        assert!(home_dir.is_some());

        let path = home_dir.unwrap();
        assert!(path.ends_with(CHIPMUNK_HOME));

        clean(path.parent().as_deref());
    }

    #[test]
    fn test_get_chipmunk_config() {
        let config_path = get_chipmunk_config();
        assert!(config_path.is_some());

        let path = config_path.expect("Missing config path for test cases");
        assert!(path.ends_with(AI_CONFIG_FILE));

        clean(path.parent().as_deref());
    }

    fn clean(path: Option<&Path>) {
        if path.is_some_and(|p| p.exists()) {
            std::fs::remove_dir_all(path.unwrap()).unwrap();
        }
    }
}
