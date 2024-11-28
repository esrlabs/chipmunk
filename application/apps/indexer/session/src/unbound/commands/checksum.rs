use super::CommandOutcome;
use crate::{error::ComputationError, unbound::signal::Signal};
use blake3;
use std::{
    fs::File,
    io::{self, prelude::*},
};

pub fn checksum(
    filename: &str,
    _signal: Signal,
) -> Result<CommandOutcome<String>, ComputationError> {
    let mut file =
        File::open(filename).map_err(|e| ComputationError::IoOperation(e.to_string()))?;
    let mut hasher = blake3::Hasher::new();
    let mut buffer = [0; 65536];
    loop {
        match file.read(&mut buffer) {
            Ok(0) => break,
            Ok(n) => {
                hasher.update(&buffer[..n]);
            }
            Err(ref e) if e.kind() == io::ErrorKind::Interrupted => continue,
            Err(e) => return Err(ComputationError::IoOperation(e.to_string())),
        }
    }
    Ok(CommandOutcome::Finished(hasher.finalize().to_string()))
}
