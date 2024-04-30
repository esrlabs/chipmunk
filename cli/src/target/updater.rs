use crate::dev_tools::DevTool;

pub async fn get_build_cmd() -> String {
    let cargo_path = DevTool::Cargo.path().await;

    format!(
        "{} +stable build --color always --release",
        cargo_path.to_string_lossy()
    )
}
