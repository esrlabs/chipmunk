pub fn get_build_cmd(prod: bool) -> String {
    let env = if prod { "--release" } else { "--dev" };

    format!("wasm-pack build {env} --target bundler --color always")
}
