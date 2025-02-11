use blake3::Hasher;
use ignore::Walk;
use input::Input;
use rayon::iter::{IntoParallelIterator, ParallelIterator};
use std::{
    io::{self, ErrorKind},
    path::{Path, PathBuf},
};

mod file_hash_digest;
mod hash_digest;
mod hash_error;
mod input;

pub use file_hash_digest::FileHashDigest;
pub use hash_digest::HashDigest;
pub use hash_digest::OUT_LEN;
pub use hash_error::HashError;

/// Calculates the hash of each file in the given folder considering `gitignore` rules returning
/// the combination of their checksums
///
/// * `dir_path`: Root directory to iterate through their files recursively
pub fn calc_combined_checksum<P>(dir_path: P) -> Result<HashDigest, HashError>
where
    P: AsRef<Path> + Send + Sync,
{
    run_intern(dir_path, |path, hasher| {
        calc_files_hashes(path, hasher)?.iter().for_each(|entry| {
            hasher.update(entry.hash_digest.as_bytes());
        });

        Ok(hasher.finalize().into())
    })
}

/// Calculates the hash of each file in the given folder considering `gitignore` rules and returns
/// a list of the files with their checksums
///
/// * `dir_path`: Root directory to iterate through their files recursively
pub fn calc_individual_checksum<P>(dir_path: P) -> Result<Vec<FileHashDigest>, HashError>
where
    P: AsRef<Path> + Send + Sync,
{
    run_intern(dir_path, |path, hasher| calc_files_hashes(path, hasher))
}

/// Validates the given path and prepares the run environment then calls the given function
/// returning its result
///
/// * `calc_fn`: Function that will be called inside the function with the directory path and
///   the created hasher
fn run_intern<F, T, P>(dir_path: P, calc_fn: F) -> Result<T, HashError>
where
    F: Fn(&Path, &mut blake3::Hasher) -> Result<T, HashError> + Sync + Send,
    P: AsRef<Path> + Send + Sync,
    T: Send + Sync,
{
    let dir_path = dir_path.as_ref();
    if !dir_path.is_dir() {
        return Err(io::Error::new(
            ErrorKind::InvalidInput,
            format!(
                "Given path must be a directory. path: {}",
                dir_path.display()
            ),
        )
        .into());
    }

    let mut hasher = blake3::Hasher::new();

    calc_fn(dir_path, &mut hasher)
}

/// Walks through file trees calculate the checksum for each files of them
///
/// * `dir_path`: Path of directory to walk the files from
fn calc_files_hashes<P: AsRef<Path>>(
    dir_path: P,
    hasher: &blake3::Hasher,
) -> Result<Vec<FileHashDigest>, HashError> {
    let entries: Vec<PathBuf> = Walk::new(dir_path)
        .filter_map(|dir_entry| dir_entry.map(|entry| entry.into_path()).ok())
        .filter(|path| path.is_file())
        .collect();

    entries
        .into_par_iter()
        .map(|path| calc_hash(&path, hasher).map(|hash| FileHashDigest::new(path, hash.into())))
        .collect()
}

/// Calculates the hash for the given file path
fn calc_hash(file_path: &Path, base_hasher: &Hasher) -> Result<blake3::Hash, HashError> {
    log::trace!("Calculating hash for file: {}", file_path.display());

    let mut input = Input::open(file_path)
        .map_err(|e| HashError::Entry(format!("Could not open file: {file_path:?} ({e})")))?;
    input
        .hash(base_hasher)
        .map_err(|e| HashError::Entry(format!("Could not hash file: {file_path:?} ({e})")))
}
