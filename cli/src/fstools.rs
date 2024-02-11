extern crate fs_extra;
use crate::TRACKER;
use fs_extra::dir::{copy_with_progress, CopyOptions, TransitProcess, TransitProcessResult};
use std::sync::mpsc;
use std::{fs, io::Error, path::PathBuf};

pub async fn cp_file(src: PathBuf, dest: PathBuf) -> Result<(), Error> {
    let sequence = TRACKER.start("copy file", None).await?;
    fs::copy(&src, &dest)?;
    TRACKER
        .success(
            sequence,
            &format!("copied: {} to {}", src.display(), dest.display()),
        )
        .await;
    Ok(())
}

pub async fn cp_folder(src: PathBuf, dest: PathBuf) -> Result<(), Error> {
    let sequence = TRACKER.start("copy folder", None).await?;
    let options = CopyOptions::new();
    let (tx, rx): (mpsc::Sender<TransitProcess>, mpsc::Receiver<TransitProcess>) = mpsc::channel();
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
        TRACKER
            .msg(
                sequence,
                &format!(
                    "copied: {} bytes; current: {}",
                    info.copied_bytes, info.file_name
                ),
            )
            .await;
        TRACKER.progress(sequence, None).await;
    }
    TRACKER.success(sequence, &msg).await;
    Ok(())
}

pub async fn rm_folder(path: PathBuf) -> Result<(), Error> {
    if !path.exists() {
        return Ok(());
    }
    let sequence = TRACKER.start("remove folder", None).await?;
    fs::remove_dir_all(&path)?;
    TRACKER
        .success(sequence, &format!("removed: {}", path.display(),))
        .await;
    Ok(())
}
