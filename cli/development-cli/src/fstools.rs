//! Provides function to do file system operation while communicating the progress with the
//! `Tracker`.

extern crate fs_extra;
use anyhow::{Context, Error};
use fs_extra::dir::{copy_with_progress, CopyOptions, TransitProcess, TransitProcessResult};
use std::collections::HashSet;
use std::sync::mpsc;
use std::{fs, path::PathBuf};

use crate::jobs_runner::JobDefinition;
use crate::tracker::get_tracker;

/// Spawn a job to copy a file, adding the info the report logs
pub fn cp_file(job_def: JobDefinition, src: PathBuf, dest: PathBuf) -> Result<(), Error> {
    let msg = format!("copying file: '{}' to '{}'", src.display(), dest.display());
    let tracker = get_tracker();
    tracker.msg(job_def, msg);

    fs::copy(&src, &dest).with_context(|| {
        format!(
            "Error while copying file '{}' to '{}'",
            src.display(),
            dest.display()
        )
    })?;
    tracker.msg(
        job_def,
        format!("copied: {} to {}", src.display(), dest.display()),
    );
    Ok(())
}

/// Spawn a job to copy a directory, adding the info the report logs
pub async fn cp_folder(job_def: JobDefinition, src: PathBuf, dest: PathBuf) -> Result<(), Error> {
    let options = CopyOptions::new();
    let (tx, rx): (mpsc::Sender<TransitProcess>, mpsc::Receiver<TransitProcess>) = mpsc::channel();

    let path_display = format!("'{}' to '{}'", src.display(), dest.display());

    let report_msg = format!("copying directory: {path_display}");

    let tracker = get_tracker();
    tracker.msg(job_def, report_msg);

    let _ = tokio::spawn(async move {
        copy_with_progress(src, dest, &options, |info| {
            if tx.send(info).is_err() {
                eprintln!("Fail to send copying progress");
            }
            TransitProcessResult::ContinueOrAbort
        })
    })
    .await
    .with_context(|| format!("Error while copying directory: {path_display}"))?;

    // Don't send update msg for each file more than once.
    let mut copied_set = HashSet::new();

    while let Ok(info) = rx.recv() {
        if copied_set.insert(info.file_name.clone()) {
            tracker.msg(
                job_def,
                format!(
                    "copied: {} bytes; current: {}",
                    info.copied_bytes, info.file_name
                ),
            );
        }

        tracker.progress(job_def, None);
    }

    let msg = format!("copied: {path_display}");
    tracker.msg(job_def, msg);
    Ok(())
}

/// Spawn a job to remove a directory recursively, adding the info the report logs
pub fn rm_folder(job_def: JobDefinition, path: &PathBuf) -> Result<(), Error> {
    if !path.exists() {
        return Ok(());
    }
    let tracker = get_tracker();
    tracker.msg(job_def, format!("removing directory: {}", path.display()));

    fs::remove_dir_all(path)?;

    tracker.msg(job_def, format!("removed: {}", path.display(),));
    Ok(())
}
