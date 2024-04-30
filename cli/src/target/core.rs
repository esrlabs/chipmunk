use crate::{dev_tools::DevTool, target::Target};

use super::TestCommand;

pub async fn get_test_cmds(production: bool) -> Vec<TestCommand> {
    let cargo_path = DevTool::Cargo.path().await;
    let cmd = format!(
        "{} +stable test{} --color always",
        cargo_path.to_string_lossy(),
        if production { " -r" } else { "" }
    );

    vec![TestCommand::new(cmd, Target::Core.cwd(), None)]
}
