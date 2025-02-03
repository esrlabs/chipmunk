use crate::{
    dev_tools::DevTool,
    target::{ProcessCommand, Target},
};

use super::TestSpawnCommand;

pub fn get_test_cmds(production: bool) -> Vec<TestSpawnCommand> {
    let mut args = vec![String::from("+stable"), String::from("test")];
    if production {
        args.push("-r".into());
    }
    args.push("--color".into());
    args.push("always".into());

    let cmd = ProcessCommand::new(DevTool::Cargo.cmd(), args);

    vec![TestSpawnCommand::new(cmd, Target::Core.cwd(), None)]
}
