use super::Target;

pub fn get_build_cmd(prod: bool) -> String {
    let mut path = Target::Wrapper.cwd();
    path.push("node_modules");
    path.push(".bin");
    path.push("electron-build-env");

    format!(
        "{} nj-cli build{}",
        path.to_string_lossy(),
        //TODO: Ruby code build always in release mode
        if prod { " --release" } else { "" }
    )
}
