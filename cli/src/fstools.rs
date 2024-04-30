extern crate fs_extra;
use anyhow::{Context, Error};
use fs_extra::copy_items_with_progress;
use fs_extra::dir::{copy_with_progress, CopyOptions, TransitProcess, TransitProcessResult};
use std::fmt::Display;
use std::sync::mpsc;
use std::{fs, path::PathBuf};

use crate::tracker::get_tracker;

/// Spawn a job to copy a file, adding the info the report logs
pub async fn cp_file(
    src: PathBuf,
    dest: PathBuf,
    report_logs: &mut Vec<String>,
) -> Result<(), Error> {
    let tracker = get_tracker().await;
    let sequence = tracker.start("copy file").await?;

    let msg = format!("copying file: '{}' to '{}'", src.display(), dest.display());
    report_logs.push(msg);

    fs::copy(&src, &dest).with_context(|| {
        format!(
            "Error while copying file '{}' to '{}'",
            src.display(),
            dest.display()
        )
    })?;
    tracker
        .success(
            sequence,
            &format!("copied: {} to {}", src.display(), dest.display()),
        )
        .await;
    Ok(())
}

/// Spawn a job to copy a directory, adding the info the report logs
pub async fn cp_folder(
    src: PathBuf,
    dest: PathBuf,
    report_logs: &mut Vec<String>,
) -> Result<(), Error> {
    let tracker = get_tracker().await;
    let sequence = tracker.start("copy folder").await?;
    let options = CopyOptions::new();
    let (tx, rx): (mpsc::Sender<TransitProcess>, mpsc::Receiver<TransitProcess>) = mpsc::channel();

    let path_display = format!("'{}' to '{}'", src.display(), dest.display());

    let report_msg = format!("copying directory: {path_display}");
    report_logs.push(report_msg);

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
                sequence,
                &format!(
                    "copied: {} bytes; current: {}",
                    info.copied_bytes, info.file_name
                ),
            )
            .await;
        tracker.progress(sequence, None).await;
    }

    let msg = format!("copied: {path_display}");
    tracker.success(sequence, &msg).await;
    Ok(())
}

/// Spawn a job to Copy a collection of files and folders recursively, adding copying info to the
/// log records
pub async fn cp_many(
    items: Vec<PathBuf>,
    dest: PathBuf,
    general_source: impl Display,
    logs: &mut Vec<String>,
) -> Result<(), Error> {
    let tracker = get_tracker().await;
    let sequence = tracker.start("copy file and folders").await?;
    let options = CopyOptions::new();
    let (tx, rx) = mpsc::channel();
    let path_display = format!("from '{}' to '{}'", general_source, dest.display());

    logs.extend(
        items
            .iter()
            .map(|item| format!("Item: '{}' copied to '{}'", item.display(), dest.display())),
    );

    let _ = tokio::spawn(async move {
        copy_items_with_progress(&items, dest, &options, |info| {
            if tx.send(info).is_err() {
                eprintln!("Fail to send copying progress");
            }
            TransitProcessResult::ContinueOrAbort
        })
    })
    .await
    .with_context(|| format!("Error while copying: {path_display}"))?;
    while let Ok(info) = rx.recv() {
        tracker
            .msg(
                sequence,
                &format!(
                    "copied: {} bytes; current: {}",
                    info.copied_bytes, info.file_name
                ),
            )
            .await;
        tracker.progress(sequence, None).await;
    }

    let msg = format!("copied files: {path_display}");
    tracker.success(sequence, &msg).await;
    Ok(())
}

/// Spawn a job to remove a directory recursively, adding the info the report logs
pub async fn rm_folder(path: &PathBuf) -> Result<(), Error> {
    if !path.exists() {
        return Ok(());
    }
    let tracker = get_tracker().await;
    let sequence = tracker.start("remove folder").await?;
    fs::remove_dir_all(path)?;
    tracker
        .success(sequence, &format!("removed: {}", path.display(),))
        .await;
    Ok(())
}
