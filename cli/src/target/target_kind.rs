use crate::dev_tools::DevTool;

#[derive(Debug, Clone)]
pub enum TargetKind {
    /// TypeScript
    Ts,
    /// Rust
    Rs,
}

impl TargetKind {
    /// Provide the general build command for each target type
    pub async fn build_cmd(&self, prod: bool) -> String {
        match self {
            TargetKind::Ts => {
                let yarn_path = DevTool::Yarn.path().await;
                format!(
                    "{} run {}",
                    yarn_path.to_string_lossy(),
                    if prod { "prod" } else { "build" }
                )
            }
            TargetKind::Rs => {
                let cargo_path = DevTool::Cargo.path().await;
                format!(
                    "{} build --color always{}",
                    cargo_path.to_string_lossy(),
                    if prod { " --release" } else { "" }
                )
            }
        }
    }
    /// Provide the general install command for each target type
    pub async fn install_cmd(&self, prod: bool) -> Option<String> {
        match self {
            TargetKind::Ts => {
                let yarn_path = DevTool::Yarn.path().await;
                Some(format!(
                    "{} install{}",
                    yarn_path.to_string_lossy(),
                    if prod { " --production" } else { "" }
                ))
            }
            TargetKind::Rs => None,
        }
    }
}
