extern crate tempdir;

use std::{
    fs::{self, File},
    path::PathBuf,
};

use dir_checksum::*;
use pretty_assertions::{assert_eq, assert_ne};
use tempdir::TempDir;

fn create_tmp_dir_with_file(dir_name: &'static str) -> anyhow::Result<(TempDir, PathBuf)> {
    let tmp_dir = TempDir::new(dir_name)?;
    let file_path = tmp_dir.path().join("file1.txt");
    fs::write(&file_path, "Initial text")?;

    Ok((tmp_dir, file_path))
}

#[test]
fn hash_combinations_add_then_remove_file() -> anyhow::Result<()> {
    let (tmp_dir, _) = create_tmp_dir_with_file("comb_add_remove_file")?;

    let original_hash = calc_combined_checksum(tmp_dir.path())?;

    let file_path_2 = tmp_dir.path().join("file2.txt");
    fs::write(&file_path_2, "Initial text 2")?;

    assert_ne!(
        original_hash,
        calc_combined_checksum(tmp_dir.path())?,
        "Hashes after adding one file can't be the same"
    );

    fs::remove_file(file_path_2)?;

    assert_eq!(
        original_hash,
        calc_combined_checksum(tmp_dir.path())?,
        "Hashes after deleting the second file must be identical again"
    );

    Ok(())
}

#[test]
fn hash_combinations_change_file_content() -> anyhow::Result<()> {
    let (tmp_dir, file_path_1) = create_tmp_dir_with_file("comg_change_contnet")?;

    let original_hash = calc_combined_checksum(tmp_dir.path())?;

    fs::write(&file_path_1, "changed text")?;
    assert_ne!(
        original_hash,
        calc_combined_checksum(tmp_dir.path())?,
        "Hashes after changing file content can't be the same"
    );

    Ok(())
}

#[test]
fn hash_combinations_empty_file() -> anyhow::Result<()> {
    let (tmp_dir, _) = create_tmp_dir_with_file("comb_empty_file")?;

    let original_hash = calc_combined_checksum(tmp_dir.path())?;

    // Create an empty file
    let empty_file_path = tmp_dir.path().join("empty.txt");
    let empty_file = File::create(&empty_file_path)?;
    drop(empty_file);

    assert_ne!(
        original_hash,
        calc_combined_checksum(tmp_dir.path())?,
        "Hashes after creating an empty file can't be the same"
    );

    Ok(())
}

#[test]
fn hash_combinations_add_then_remove_sub_dir() -> anyhow::Result<()> {
    let (tmp_dir, _) = create_tmp_dir_with_file("comb_sub_dir")?;

    let original_hash = calc_combined_checksum(tmp_dir.path())?;

    let sub_dir = tmp_dir.path().join("sub_dir");
    fs::create_dir(&sub_dir)?;

    let file_path_2 = sub_dir.join("file2.txt");
    fs::write(&file_path_2, "Initial text 2")?;

    assert_ne!(
        original_hash,
        calc_combined_checksum(tmp_dir.path())?,
        "Hashes after adding one file in sub directory can't be the same"
    );

    fs::remove_file(file_path_2)?;

    assert_eq!(
        original_hash,
        calc_combined_checksum(tmp_dir.path())?,
        "Hashes after deleting the file in sub directory must be identical again"
    );

    Ok(())
}

#[test]
fn hash_individual_many_files() -> anyhow::Result<()> {
    let (tmp_dir, _) = create_tmp_dir_with_file("indiv_files")?;

    // Create non-empty file
    let file2_path = tmp_dir.path().join("file2.txt");
    fs::write(file2_path, "file 2 content")?;

    // Create empty file
    let empty_file_path = tmp_dir.path().join("empty.txt");
    let _ = File::create(&empty_file_path)?;

    let items = calc_individual_checksum(tmp_dir.path())?;

    assert_eq!(items.len(), 3, "Hashes count must be 3");

    assert_eq!(
        &items,
        &calc_individual_checksum(tmp_dir.path())?,
        "Hash items must be identical"
    );

    Ok(())
}

#[test]
fn hash_individual_sub_directory() -> anyhow::Result<()> {
    let (tmp_dir, _) = create_tmp_dir_with_file("indiv_sub_dir")?;

    let sub_dir = tmp_dir.path().join("sub_dir");
    fs::create_dir(&sub_dir)?;

    // Create non-empty file
    let file2_path = &sub_dir.join("file2.txt");
    fs::write(file2_path, "file 2 content")?;

    // Create empty file
    let empty_file_path = &sub_dir.join("empty.txt");
    let empty_file = File::create(empty_file_path)?;
    drop(empty_file);

    let items = calc_individual_checksum(tmp_dir.path())?;

    assert_eq!(items.len(), 3, "Hashes count must be 3");

    assert_eq!(
        &items,
        &calc_individual_checksum(tmp_dir.path())?,
        "Hash items must be identical"
    );

    Ok(())
}
