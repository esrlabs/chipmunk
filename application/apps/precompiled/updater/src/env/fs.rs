use std::{fs, path::Path};

pub fn remove_entity(entity: &Path) -> Result<(), std::io::Error> {
    if !entity.exists() {
        return Ok(());
    }
    if entity.is_dir() {
        fs::remove_dir_all(entity)?;
    } else if entity.is_file() {
        fs::remove_file(entity)?;
    }
    Ok(())
}
