use crate::node_cmd;

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
            TargetKind::Ts => format!(
                "{} run {}",
                node_cmd::YARN,
                if prod { "prod" } else { "build" }
            ),
            TargetKind::Rs => format!(
                "cargo build --color always{}",
                if prod { " --release" } else { "" }
            ),
        }
    }
    pub fn install_cmd(&self, prod: bool) -> Option<String> {
        match self {
            TargetKind::Ts => Some(format!(
                "{} install{}",
                node_cmd::YARN,
                if prod { " --production" } else { "" }
            )),
            TargetKind::Rs => None,
        }
    }
}
