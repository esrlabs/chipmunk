mod bundle;
mod compress;
mod env_utls;
mod paths;

use std::{fs, time::Instant};

use anyhow::{ensure, Context};
use bundle::bundle_release;
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
pub async fn do_release(development: bool) -> anyhow::Result<()> {
    debug_assert!(
        !get_tracker().show_bars(),
        "Release shouldn't run with UI bars"
    );

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

    jobs_runner::run(
        &[Target::App, Target::Updater],
        JobType::Build {
            production: !development,
        },
    )
    .await
    .context("Build Chipmunk failed")?;

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
