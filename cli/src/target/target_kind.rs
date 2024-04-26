#[derive(Debug, Clone)]
pub enum TargetKind {
    /// TypeScript
    Ts,
    /// Rust
    Rs,
}

impl TargetKind {
    pub fn build_cmd(&self, prod: bool) -> String {
        match self {
            TargetKind::Ts => format!("yarn run {}", if prod { "prod" } else { "build" }),
            TargetKind::Rs => format!(
                "cargo build --color always{}",
                if prod { " --release" } else { "" }
            ),
        }
    }
    pub fn install_cmd(&self, prod: bool) -> Option<String> {
        match self {
            TargetKind::Ts => Some(format!(
                "yarn install{}",
                if prod { " --production" } else { "" }
            )),
            TargetKind::Rs => None,
        }
    }
}
