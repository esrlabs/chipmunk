use crate::{
    dev_tools::DevTool,
    target::{ProcessCommand, Target},
};

use super::TestSpawnCommand;

pub fn get_test_cmds(production: bool) -> Vec<TestSpawnCommand> {
    let cargo_path = DevTool::Cargo.path();

    let mut args = vec![String::from("+stable"), String::from("test")];
    if production {
        args.push("-r".into());
    }
    args.push("--color".into());
    args.push("always".into());

    let cmd = ProcessCommand::new(cargo_path.to_string_lossy().to_string(), args);

    vec![TestSpawnCommand::new(cmd, Target::Core.cwd(), None)]
}
