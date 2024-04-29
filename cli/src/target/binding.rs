use std::fs;

use anyhow::{bail, Context};

use crate::{fstools, spawner::SpawnResult};

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

pub async fn copy_index_node() -> Result<Option<SpawnResult>, anyhow::Error> {
    let mut report_logs = Vec::new();

    // *** Copy `index.node` from rs to ts bindings dist ***
    report_logs.push(String::from("Copying `index.node` to ts-bindings dist..."));

    let src_file = Target::Binding.cwd().join("dist").join("index.node");
    if !src_file.exists() {
        bail!(
            "Error while copying `rs-bindings`. Err: Not found: {}",
            src_file.to_string_lossy()
        );
    }

    let ts_dist_native_dir = Target::Wrapper.cwd().join("dist").join("native");
    if !ts_dist_native_dir.exists() {
        let msg = format!("creating directory: {}", ts_dist_native_dir.display());
        report_logs.push(msg);

        fs::create_dir_all(&ts_dist_native_dir).with_context(|| {
            format!(
                "Error while creating directory: {}",
                ts_dist_native_dir.display()
            )
        })?;
    }

    fstools::cp_file(
        src_file.clone(),
        ts_dist_native_dir.join("index.node"),
        &mut report_logs,
    )
    .await?;

    // *** Copy `index.node` from rs to ts bindings src native (dir-tests) ***
    report_logs.push(String::from(
        "Copying `index.node` to ts-bindings src native...",
    ));

    let dir_tests = Target::Wrapper.cwd().join("src").join("native");
    let mod_file = dir_tests.join("index.node");

    fstools::cp_file(src_file, mod_file, &mut report_logs).await?;

    Ok(Some(SpawnResult::create_for_fs(
        "Copying `index.node` from rs to ts bindings".into(),
        report_logs,
    )))
}