use crate::target::Target;

use super::TestCommand;

pub fn get_test_cmds(production: bool) -> Vec<TestCommand> {
    let cmd = format!(
        "cargo +stable test{} --color always",
        if production { " -r" } else { "" }
    );

    vec![TestCommand::new(cmd, Target::Core.cwd(), None)]
}
