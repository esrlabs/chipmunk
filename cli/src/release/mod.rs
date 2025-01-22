//! Manages creating releases of Chipmunk on the current platform, including building, bundling the
//! app with snapshot file if needed, then compressing to provide one file for each platform with
//! current version of Chipmunk.
//!
//! This method is meant to be used in CD pipeline when a release is created to provide the release
//! assets for each supported platform.

mod bundle;
mod codesign;
mod compress;
mod env_utls;
mod paths;

use std::{fs, path::PathBuf, time::Instant};

use anyhow::{ensure, Context};
use bundle::bundle_release;
use codesign::CodeSign;
use compress::compress;
use console::style;
use env_utls::load_from_env_file;
use paths::release_path;

use crate::{
    job_type::JobType, jobs_runner, log_print::print_log_separator, target::Target,
    tracker::get_tracker,
};

/// Builds, bundles and compress Chipmunk with configurations for each platform.
///
/// * `development`: Sets if Chipmunk should be built in development mode.
/// * `code_sign_path`: Path to the configuration file to do code signing.
pub async fn do_release(development: bool, code_sign_path: Option<PathBuf>) -> anyhow::Result<()> {
    debug_assert!(
        !get_tracker().show_bars(),
        "Release shouldn't run with UI bars"
    );

    let code_sign = match code_sign_path {
        Some(config_path) => Some(CodeSign::load(config_path)?),
        None => None,
    };

    let release_start = Instant::now();

    load_from_env_file();

    // *** Clean previous releases ***

    println!(
        "{}",
        style("Start Clean previous release...")
            .blue()
            .bright()
            .bold()
    );

    clean_release()?;

    println!(
        "{}",
        style("Clean previous release succeeded...").green().bold()
    );

    print_log_separator();

    // *** Build Chipmunk ***

    println!(
        "{}",
        style("Start Building Chipmunk Application...")
            .blue()
            .bright()
            .bold()
    );

    // *** Build Chipmunk ***

    let build_start = Instant::now();

    println!(
        "{}",
        style("Start Building Chipmunk Process...")
            .blue()
            .bright()
            .bold()
    );

    let results = jobs_runner::run(
        &[Target::App, Target::Updater],
        JobType::Build {
            production: !development,
        },
    )
    .await
    .context("Build Chipmunk failed")?;

    // Check for failing jobs
    let success = results
        .iter()
        .all(|r| r.as_ref().is_ok_and(|s| s.status.success()));
    ensure!(success, "Build Chipmunk failed: Some tasks have failed");

    let msg = format!(
        "Building Chipmunk Application succeeded in {} seconds.",
        build_start.elapsed().as_secs().max(1)
    );
    println!("{}", style(msg).green().bold());

    print_log_separator();

    // *** Bundle Chipmunk ***

    println!(
        "{}",
        style("Start Release Bundle Process...")
            .blue()
            .bright()
            .bold()
    );

    let bundle_start = Instant::now();

    bundle_release().await?;

    let finish_msg = format!(
        "Release Bundle succeeded in {} seconds.",
        bundle_start.elapsed().as_secs().max(1)
    );
    println!("{}", style(finish_msg).green().bold());

    print_log_separator();

    // *** Code Sign ***

    if let Some(code_sign) = code_sign.as_ref() {
        if code_sign.allowed() {
            println!("{}", style("Start Code Signing...").blue().bright().bold());
            let codesign_start = Instant::now();
            code_sign.apply_codesign()?;

            let finish_msg = format!(
                "Code signing succeeded in {} seconds.",
                codesign_start.elapsed().as_secs().max(1)
            );
            println!("{}", style(finish_msg).green().bold());
        } else {
            println!();
            println!(
                "{}",
                style("Code Signing isn't allowed due to the environment variables")
                    .yellow()
                    .bold()
            );
        }

        print_log_separator();
    }

    // *** Compressing ***

    println!(
        "{}",
        style("Start Compressing release files...")
            .blue()
            .bright()
            .bold()
    );

    let compress_start = Instant::now();

    compress().await?;

    let finish_msg = format!(
        "Compressing succeeded in {} seconds.",
        compress_start.elapsed().as_secs().max(1)
    );
    println!("{}", style(finish_msg).green().bold());

    print_log_separator();

    // *** Notarize ***

    if let Some(code_sign) = code_sign {
        if code_sign.allowed() {
            println!(
                "{}",
                style("Start Code Notarizing...").blue().bright().bold()
            );
            let notarizing_start = Instant::now();
            code_sign.notarize()?;

            let finish_msg = format!(
                "Code notarizing succeeded in {} seconds.",
                notarizing_start.elapsed().as_secs().max(1)
            );
            println!("{}", style(finish_msg).green().bold());
        } else {
            println!();
            println!(
                "{}",
                style("Code Notarizing isn't allowed due to the environment variables")
                    .yellow()
                    .bold()
            );
        }

        print_log_separator();
    }

    // *** Final results ***

    println!();
    let finish_msg = format!(
        "*** Chipmunk Release succeeded in {} seconds. ***",
        release_start.elapsed().as_secs()
    );

    println!("{}", style(finish_msg).green().bold());

    Ok(())
}

/// Clean existing release if needed.
fn clean_release() -> anyhow::Result<()> {
    let release_path = release_path();

    if !release_path.exists() {
        return Ok(());
    }

    println!(
        "Removing release directory, path: {}",
        release_path.display()
    );

    fs::remove_dir_all(&release_path)?;

    println!(
        "Release directory removed, path: {}",
        release_path.display()
    );

    Ok(())
}
