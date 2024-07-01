extern crate fs_extra;
use anyhow::{Context, Error};
use fs_extra::dir::{copy_with_progress, CopyOptions, TransitProcess, TransitProcessResult};
use std::sync::mpsc;
use std::{fs, path::PathBuf};

use crate::jobs_runner::JobDefinition;
use crate::tracker::get_tracker;

/// Spawn a job to copy a file, adding the info the report logs
pub async fn cp_file(
    job_def: JobDefinition,
    src: PathBuf,
    dest: PathBuf,
    report_logs: &mut Vec<String>,
) -> Result<(), Error> {
    let msg = format!("copying file: '{}' to '{}'", src.display(), dest.display());
    report_logs.push(msg);

    let tracker = get_tracker();
    tracker.msg(job_def, "copying files".into()).await;

    fs::copy(&src, &dest).with_context(|| {
        format!(
            "Error while copying file '{}' to '{}'",
            src.display(),
            dest.display()
        )
    })?;
    tracker
        .msg(
            job_def,
            format!("copied: {} to {}", src.display(), dest.display()),
        )
        .await;
    Ok(())
}

/// Spawn a job to copy a directory, adding the info the report logs
pub async fn cp_folder(
    job_def: JobDefinition,
    src: PathBuf,
    dest: PathBuf,
    report_logs: &mut Vec<String>,
) -> Result<(), Error> {
    let options = CopyOptions::new();
    let (tx, rx): (mpsc::Sender<TransitProcess>, mpsc::Receiver<TransitProcess>) = mpsc::channel();

    let path_display = format!("'{}' to '{}'", src.display(), dest.display());

    let report_msg = format!("copying directory: {path_display}");
    report_logs.push(report_msg.clone());

    let tracker = get_tracker();
    tracker.msg(job_def, report_msg).await;

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
    while let Ok(info) = rx.recv() {
        tracker
            .msg(
                job_def,
                format!(
                    "copied: {} bytes; current: {}",
                    info.copied_bytes, info.file_name
                ),
            )
            .await;
        tracker.progress(job_def, None).await;
    }

    let msg = format!("copied: {path_display}");
    tracker.msg(job_def, msg).await;
    Ok(())
}

/// Spawn a job to remove a directory recursively, adding the info the report logs
pub async fn rm_folder(job_def: JobDefinition, path: &PathBuf) -> Result<(), Error> {
    if !path.exists() {
        return Ok(());
    }
    let tracker = get_tracker();
    tracker
        .msg(job_def, format!("removing directory: {}", path.display()))
        .await;

    fs::remove_dir_all(path)?;

    tracker
        .msg(job_def, format!("removed: {}", path.display(),))
        .await;
    Ok(())
}
