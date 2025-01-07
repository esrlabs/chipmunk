//! Module to manage the track changes between each run by comparing the files' states
//! and the included additional features between the current and the previous build run.
//! File comparison is done by calculating the checksum of the files on each target then comparing
//! it with persisted checksum from the last run.  
//!
//! This module manages saving the loading the state records as well.

use std::{
    collections::{BTreeMap, BTreeSet},
    fs::File,
    io::{BufReader, BufWriter},
    path::PathBuf,
    sync::{Mutex, OnceLock},
};

use anyhow::{anyhow, Context};
use console::style;
use dir_checksum::calc_combined_checksum;
use serde::{Deserialize, Serialize};

use crate::{
    job_type::JobType, jobs_runner::additional_features::AdditionalFeatures, location::get_root,
    target::Target, JobsState,
};

/// Deprecated filenames that were used previously.
const DEPRECATED_FILE_NAMES: [&str; 2] = [".build_chksum_dev", ".build_chksum_prod"];

/// Name of the file used to save the state of the last build run.
const PERSIST_FILE_NAME: &str = ".build_last_state";

#[derive(Debug, Serialize, Deserialize)]
/// Manages and compares the file states for the targets between current and previous builds.
/// It calculates the checksums of the files for each targets and saves them to a file after
/// each build, and for the next build it'll calculate the checksum again and compare it with
/// the saved one.
/// It also manages loading and clearing the saved checksum records as well.
pub struct BuildStateRecords {
    production: bool,
    states: BTreeMap<Target, TargetBuildState>,
    #[serde(skip)]
    involved_targets: BTreeSet<Target>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
struct TargetBuildState {
    hash: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(default)]
    features: Option<BTreeSet<AdditionalFeatures>>,
}

impl TargetBuildState {
    pub fn new(hash: String) -> Self {
        Self {
            hash,
            features: None,
        }
    }

    pub fn add_feature(&mut self, feature: AdditionalFeatures) {
        let features = self.features.get_or_insert_with(BTreeSet::new);
        features.insert(feature);
    }
}

/// Represents the comparison's result between the saved Checksum and the calculate one for the
/// build target
#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub enum ChecksumCompareResult {
    Same,
    Changed,
}

impl BuildStateRecords {
    pub fn new(production: bool) -> Self {
        Self {
            production,
            states: BTreeMap::default(),
            involved_targets: BTreeSet::default(),
        }
    }

    /// Update checksum records for involved jobs depending on the job type.
    /// It will calculate new checksums if build tasks were involved.
    pub fn update_and_save(job_type: JobType) -> anyhow::Result<()> {
        // Records should be involved when build is called at some point of the job or by clean.
        let (records_involved, prod) = match &job_type {
            // Linting build targets for TS targets and their dependencies
            JobType::Lint => (true, false),
            JobType::Build { production }
            | JobType::Run { production }
            | JobType::Test { production } => (true, *production),
            // With clean we need to remove the whole records file.
            JobType::Clean => return Self::remove_records_file(),
            JobType::Install { production } | JobType::AfterBuild { production } => {
                (false, *production)
            }
        };

        let records = Self::get(prod)?;

        let mut rec = records
            .lock()
            .map_err(|err| anyhow!("Error while acquiring items jobs mutex: Error {err}"))?;

        if records_involved {
            rec.update_records()?;
        }

        rec.persist_build_state()
            .context("Error while saving the updated build states")?;

        Ok(())
    }

    /// Returns a reference to build states' records manager singleton
    pub fn get(production: bool) -> anyhow::Result<&'static Mutex<BuildStateRecords>> {
        static CHECKSUM_RECORDS: OnceLock<anyhow::Result<Mutex<BuildStateRecords>>> =
            OnceLock::new();

        CHECKSUM_RECORDS
            .get_or_init(|| BuildStateRecords::load(production).map(Mutex::new))
            .as_ref()
            .map_err(|err| anyhow!("{err}"))
    }

    /// Loads the persisted records from states file if exist
    /// The states from previous build will be ignored in case production state between
    /// them is different.
    fn load(production: bool) -> anyhow::Result<Self> {
        let file_path = Self::persist_file_path();

        let records = if file_path.exists() {
            let file = File::open(&file_path).with_context(|| {
                format!(
                    "Error while opening last build state records file. Path: {}",
                    file_path.display()
                )
            })?;
            let reader = BufReader::new(file);
            let mut records: Self = serde_json::from_reader(reader)?;

            // Production and development use the same artifacts which will lead to false
            // positives when the artifacts are modified via another build but the checksum of
            // source files still the same.
            // To solve this problem we will reset the states of the opposite build production
            // type when build is involved in the current process
            if records.production != production {
                records = Self::new(production);
            }
            records
        } else {
            Self::new(production)
        };

        Ok(records)
    }

    /// Gets the path of the file where the build states are saved
    fn persist_file_path() -> PathBuf {
        get_root().join(PERSIST_FILE_NAME)
    }

    /// Remove deprecated files which were used to persist hashes only.
    /// TODO: Remove this function when enough time has passed.
    fn cleanup_depr_files() {
        let root = get_root();
        DEPRECATED_FILE_NAMES
            .iter()
            .map(|name| root.join(name))
            .filter(|path| path.exists())
            .for_each(|path| {
                if let Err(err) = std::fs::remove_file(&path) {
                    let msg = format!(
                        "Error while removing deprecated checksum files.\n\
                            File paht: {}\nError: {err:#?}",
                        path.display()
                    );

                    eprintln!("{}", style(msg).yellow());
                }
            })
    }

    /// Removes the records file if exists
    pub fn remove_records_file() -> anyhow::Result<()> {
        Self::cleanup_depr_files();

        let file_path = Self::persist_file_path();
        if file_path.exists() {
            std::fs::remove_file(&file_path).with_context(|| {
                format!(
                    "Error while removing the file {} to reset build state records",
                    file_path.display()
                )
            })?;
        }

        Ok(())
    }

    /// Marks the job is involved in the record tracker
    pub fn register_job(&mut self, target: Target) -> anyhow::Result<()> {
        self.involved_targets.insert(target);
        Ok(())
    }

    /// Compares the current build state for the given target with the previous run by calculating
    /// and comparing the files checksum and the applied additional features to the given target.
    ///
    /// # Panics
    ///
    /// This method panics if the provided target isn't registered
    pub fn compare_checksum(&self, target: Target) -> anyhow::Result<ChecksumCompareResult> {
        assert!(self.involved_targets.contains(&target));
        let saved_state = match self.states.get(&target) {
            Some(state) => state,
            // If there is no existing checksum to compare with, then the checksums state has
            // changed.
            None => return Ok(ChecksumCompareResult::Changed),
        };

        let current_hash = Self::calc_hash_for_target(target)?;

        // Check for the hash only at first then check the additional features.
        let comparison = if current_hash == saved_state.hash {
            let mut target_features = None;
            JobsState::get()
                .additional_features()
                .iter()
                .filter(|f| f.apply_to_target() == target)
                .for_each(|feature| {
                    target_features
                        .get_or_insert_with(BTreeSet::new)
                        .insert(*feature);
                });

            if target_features == saved_state.features {
                ChecksumCompareResult::Same
            } else {
                ChecksumCompareResult::Changed
            }
        } else {
            ChecksumCompareResult::Changed
        };

        Ok(comparison)
    }

    /// Calculates the checksums for the source files of the given target
    /// returning it converted to a string.
    fn calc_hash_for_target(target: Target) -> anyhow::Result<String> {
        let path = target.cwd();
        calc_combined_checksum(path)
            .map(|digst| digst.to_string())
            .with_context(|| {
                format!("Error while calculating the current hash for target: {target}",)
            })
    }

    /// Remove the target from the states records
    pub fn remove_state_if_exist(&mut self, target: Target) -> anyhow::Result<()> {
        self.involved_targets.insert(target);

        self.states.remove(&target);

        Ok(())
    }

    /// Clears the states from previous build then calculates the states for the involved targets.
    fn update_records(&mut self) -> anyhow::Result<()> {
        self.states.clear();

        let additional_features = JobsState::get().additional_features();
        for target in self.involved_targets.clone() {
            let hash = Self::calc_hash_for_target(target)?;
            let mut target_state = TargetBuildState::new(hash);
            additional_features
                .iter()
                .filter(|f| f.apply_to_target() == target)
                .for_each(|f| {
                    target_state.add_feature(*f);
                });
            self.states.insert(target, target_state);
        }

        Ok(())
    }

    fn persist_build_state(&self) -> anyhow::Result<()> {
        let file_path = Self::persist_file_path();

        let file = File::create(&file_path).with_context(|| {
            format!(
                "Creating build states file failed. Path: {}",
                file_path.display()
            )
        })?;
        let writer = BufWriter::new(file);
        serde_json::to_writer_pretty(writer, self)
            .context("Error while serializing build state to persist them")?;
        Ok(())
    }
}
