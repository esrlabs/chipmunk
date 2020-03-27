use anyhow::Result;
use flate2::write::GzEncoder;
use flate2::Compression;
use log::*;

use flate2::read::GzDecoder;
use std::fs::File;
use std::path::{Path, PathBuf};
use tar::Archive;

const RELEASE_FILE_NAME: &str = ".release";

pub fn remove_entity(entity: &Path) -> Result<()> {
    if !entity.exists() {
        return Ok(());
    }
    if entity.is_dir() {
        std::fs::remove_dir_all(&entity)?;
    } else if entity.is_file() {
        std::fs::remove_file(&entity)?;
    }
    Ok(())
}

pub fn tarball_app(app_folder: &Path, tmp_dir_path: &Path) -> Result<PathBuf> {
    use chrono::{Datelike, Local, Timelike};

    let now = Local::now();
    let backup_path = tmp_dir_path.join(format!(
        "backup_{}_{}_{}-{}.{}.{}.tar.gz",
        now.year(),
        now.month(),
        now.day(),
        now.hour(),
        now.minute(),
        now.second(),
    ));
    let tar_gz = File::create(&backup_path)?;
    let enc = GzEncoder::new(tar_gz, Compression::fast());
    let mut tar = tar::Builder::new(enc);
    if cfg!(target_os = "macos") {
        tar.append_dir_all("chipmunk.app", app_folder)?;
    } else {
        tar.append_dir_all("", app_folder)?;
    };
    Ok(backup_path)
}

pub fn unpack(tgz: &Path, dest: &Path) -> Result<()> {
    // Unpack
    info!("File {:?} will be unpacked into {:?}", tgz, dest);

    let tar_gz = File::open(&tgz)?;
    let tar = GzDecoder::new(tar_gz);
    let mut archive = Archive::new(tar);
    archive.unpack(&dest)?;

    Ok(())
}

pub fn collect_release_files(app: &Path) -> Option<Vec<String>> {
    let release_file: PathBuf = app.to_path_buf().join(RELEASE_FILE_NAME);
    if !release_file.exists() {
        warn!("Fail to find release file {:?}", release_file);
        return None;
    }
    match std::fs::read_to_string(&release_file) {
        Err(e) => {
            error!("Error to read file {:?}: {}", release_file, e);
            None
        }
        Ok(content) => Some(content.lines().map(|s| s.to_string()).collect()),
    }
}

#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use super::*;
    use ring::digest::{Context, Digest, SHA256};
    use std::fs::File;
    use std::io::{BufReader, Read};
    use tempdir::TempDir;
    static LOREM_IPSUM: &str =
        "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod
tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse
cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
";

    fn sha256_digest(f: &Path) -> Digest {
        let input = File::open(&f).unwrap();
        let mut reader = BufReader::new(input);

        let mut context = Context::new(&SHA256);
        let mut buffer = [0; 1024];

        loop {
            let count = reader.read(&mut buffer).unwrap();
            if count == 0 {
                break;
            }
            context.update(&buffer[..count]);
        }

        context.finish()
    }
    #[test]
    fn test_pack_unpack() {
        use std::io::Write;
        let tmp_dir_path = TempDir::new("unpack").unwrap();
        let source_dir = tmp_dir_path.path().join("sources");
        let dest_dir = tmp_dir_path.path().join("dest");
        std::fs::create_dir_all(&source_dir).unwrap();
        std::fs::create_dir_all(&dest_dir).unwrap();
        let file_names = ["a.txt", "b.txt", "c.txt"];
        for p in &file_names {
            let mut f = File::create(source_dir.join(p)).expect("could not create file");
            f.write_all(LOREM_IPSUM.as_bytes())
                .expect("could not write to file");
        }
        let tgz = tarball_app(&source_dir, &tmp_dir_path.path()).expect("packing failed");
        unpack(&tgz, &dest_dir).expect("could not unpack");
        for n in &file_names {
            assert_eq!(
                sha256_digest(&source_dir.join(n)).as_ref(),
                sha256_digest(&dest_dir.join(n)).as_ref()
            );
        }
        println!("done...waiting");
    }

    #[test]
    fn test_collect_release_files() {
        match std::env::current_exe() {
            Err(e) => println!("Error {}", e),
            Ok(exe_path) => {
                let relative_path: &str = "application/apps/launch_and_update";
                println!("App is running with {}", exe_path.display());
                let parts: Vec<&str> = exe_path
                    .to_str()
                    .expect("exe path invalid")
                    .split(relative_path)
                    .collect();
                println!("current exe path: {:?}", parts);
                assert_eq!(parts.len(), 2);
                let test_folder = Path::new(&parts[0]).join(format!("{}/tests", relative_path));
                println!("Parent folder of path is {}", test_folder.display());
                match collect_release_files(&test_folder) {
                    None => {
                        println!("Fail get list");
                    }
                    Some(entries) => {
                        println!("Next etries are read {:?}", entries);
                        assert_eq!(entries.len(), 4);
                        assert_eq!(entries, ["file_a", "file_b", "file_c", "folder_a"]);
                    }
                }
            }
        }
    }
}
