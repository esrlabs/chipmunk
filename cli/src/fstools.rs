extern crate fs_extra;
use anyhow::Error;
use fs_extra::copy_items_with_progress;
use fs_extra::dir::{copy_with_progress, CopyOptions, TransitProcess, TransitProcessResult};
use std::fmt::Display;
use std::sync::mpsc;
use std::{fs, path::PathBuf};

use crate::tracker::get_tracker;

pub async fn cp_file(
    src: PathBuf,
    dest: PathBuf,
    report_logs: &mut Vec<String>,
) -> Result<(), Error> {
    let tracker = get_tracker().await;
    let sequence = tracker.start("copy file", None).await?;

    let msg = format!("copying file: '{}' to '{}'", src.display(), dest.display());
    report_logs.push(msg);

    fs::copy(&src, &dest)?;
    tracker
        .success(
            sequence,
            &format!("copied: {} to {}", src.display(), dest.display()),
        )
        .await;
    Ok(())
}

pub async fn cp_folder(
    src: PathBuf,
    dest: PathBuf,
    report_logs: &mut Vec<String>,
) -> Result<(), Error> {
    let tracker = get_tracker().await;
    let sequence = tracker.start("copy folder", None).await?;
    let options = CopyOptions::new();
    let (tx, rx): (mpsc::Sender<TransitProcess>, mpsc::Receiver<TransitProcess>) = mpsc::channel();

    let msg = format!(
        "copying directory: '{}' to '{}'",
        src.display(),
        dest.display()
    );
    report_logs.push(msg);

    let msg = format!("copied: {} to {}", src.display(), dest.display());

    let _ = tokio::spawn(async move {
        if let Err(e) = copy_with_progress(src, dest, &options, |info| {
            if tx.send(info).is_err() {
                eprintln!("Fail to send copying progress");
            }
            TransitProcessResult::ContinueOrAbort
        }) {
            panic!("Fail to copy: {e}")
        }
    })
    .await;
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
    tracker.success(sequence, &msg).await;
    Ok(())
}

/// Copy a collection of files and folders recursively.
pub async fn cp_many(
    items: Vec<PathBuf>,
    dest: PathBuf,
    general_source: impl Display,
    logs: &mut Vec<String>,
) -> Result<(), Error> {
    let tracker = get_tracker().await;
    let sequence = tracker.start("copy file and folders", None).await?;
    let options = CopyOptions::new();
    let (tx, rx) = mpsc::channel();
    let msg = format!(
        "copied files: from {} to {}",
        general_source,
        dest.display()
    );

    logs.extend(
        items
            .iter()
            .map(|item| format!("Item: '{}' copied to '{}'", item.display(), dest.display())),
    );

    let _ = tokio::spawn(async move {
        if let Err(e) = copy_items_with_progress(&items, dest, &options, |info| {
            if tx.send(info).is_err() {
                eprintln!("Fail to send copying progress");
            }
            TransitProcessResult::ContinueOrAbort
        }) {
            panic!("Fail to copy: {e}")
        }
    })
    .await;
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
    tracker.success(sequence, &msg).await;
    Ok(())
}

pub async fn rm_folder(path: &PathBuf) -> Result<(), Error> {
    if !path.exists() {
        return Ok(());
    }
    let tracker = get_tracker().await;
    let sequence = tracker.start("remove folder", None).await?;
    fs::remove_dir_all(path)?;
    tracker
        .success(sequence, &format!("removed: {}", path.display(),))
        .await;
    Ok(())
}
