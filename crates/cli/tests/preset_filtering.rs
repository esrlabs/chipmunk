//! End-to-end check that `--preset` restricts the text output to matching records.

use std::{fs, path::PathBuf, process::Command};

/// The only filter of the preset fixture, matching a part of the sample DLT file.
const FILTER_VALUE: &str = "ecu2";

fn resource(rel_path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../development/resources")
        .join(rel_path)
}

fn run_cli(args: &[&str]) {
    let status = Command::new(env!("CARGO_BIN_EXE_chipmunk-cli"))
        .args(args)
        .status()
        .expect("Running chipmunk-cli failed");

    assert!(status.success(), "chipmunk-cli failed for args: {args:?}");
}

#[test]
fn preset_writes_matching_records_only() {
    let dir = tempfile::tempdir().unwrap();
    let full_path = dir.path().join("full.txt");
    let filtered_path = dir.path().join("filtered.txt");

    let preset = resource("presets/cli/attachments_ecu2.json");
    let preset = preset.to_str().unwrap();

    let input = resource("attachments.dlt");
    let input = input.to_str().unwrap();

    run_cli(&[
        "-o",
        full_path.to_str().unwrap(),
        "-f",
        "text",
        "dlt",
        "file",
        input,
    ]);
    run_cli(&[
        "-o",
        filtered_path.to_str().unwrap(),
        "-f",
        "text",
        "-p",
        preset,
        "dlt",
        "file",
        input,
    ]);

    let full = fs::read_to_string(&full_path).unwrap();
    let filtered = fs::read_to_string(&filtered_path).unwrap();

    // The expectation is computed from the unfiltered run to stay independent of
    // the DLT payload. Comparing output lines is valid here because the filter
    // text does not span column separators: the CLI matches the canonical
    // message rendering while the output uses the configured separators.
    let expected: Vec<&str> = full
        .lines()
        .filter(|line| line.to_lowercase().contains(FILTER_VALUE))
        .collect();
    let written: Vec<&str> = filtered.lines().collect();

    assert_eq!(written, expected);
    assert!(!written.is_empty(), "Filter must match a part of the input");
    assert!(
        written.len() < full.lines().count(),
        "Filter must drop a part of the input"
    );
}
