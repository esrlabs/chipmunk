use std::{
    collections::{btree_map, BTreeMap, BTreeSet},
    fs::{self, File},
    io::Write,
    path::PathBuf,
    sync::{Mutex, OnceLock},
};

use anyhow::{anyhow, Context};
use dir_checksum::{calc_combined_checksum, HashDigest};

use crate::{job_type::JobType, location::get_root, target::Target};

const FILE_NAME_DEV: &str = ".build_chksum_dev";
const FILE_NAME_PROD: &str = ".build_chksum_prod";

#[derive(Debug)]
pub struct ChecksumRecords {
    items: Mutex<ChecksumItems>,
}

#[derive(Debug, Default)]
struct ChecksumItems {
    map: BTreeMap<Target, HashDigest>,
    involved_targets: BTreeSet<Target>,
}

/// Represents the comparison's result between the saved Checksum and the calculate one for the
/// build target
#[derive(Debug, Clone, Copy, Eq, PartialEq)]
pub enum ChecksumCompareResult {
    Same,
    Changed,
}

impl ChecksumRecords {
    /// Update checksum records for involved jobs depending on the job type.
    /// It will calculate new checksums if build tasks were involved.
    pub fn update_and_save(job_type: JobType) -> anyhow::Result<()> {
        // calculate should be involved when build is called at some point of the job
        let (calculate_involved, prod) = match &job_type {
            // Linting build targets for TS targets and their dependencies
            JobType::Lint => (true, false),
            JobType::Build { production }
            | JobType::Run { production }
            | JobType::Test { production } => (true, *production),
            // With clean we need to remove the items from both development and production
            JobType::Clean => (false, false),
            JobType::Install { production } | JobType::AfterBuild { production } => {
                (false, *production)
            }
        };

        let records = Self::get(prod)?;

        if calculate_involved {
            records.calculate_involved_hashes()?;

            // Production and development use the same artifacts which will lead to false
            // positives when the artifacts are modified via another build but the checksum of
            // source files still the same.
            // To solve this problem we will reset the checksums of the opposite build production
            // type when build is involved in the current process
            let outdated_record_prod = !prod;
            Self::remove_records_file(outdated_record_prod).with_context(|| {
                format!(
                    "Error while remove the outdated {} build checksum records",
                    if outdated_record_prod {
                        "production"
                    } else {
                        "development"
                    }
                )
            })?;
        }

        records
            .persist_hashes(prod)
            .context("Error while saving the updated hashes")?;

        // Hashes must be removed from production if clean is called because it doesn't
        // differentiate between development and production.
        if matches!(job_type, JobType::Clean) {
            let prod_records =
                Self::load(true).context("Error while loading production records")?;

            let dev_items = records
                .items
                .lock()
                .map_err(|err| anyhow!("Error while acquiring items jobs mutex: Error {err}"))?;

            // With clean job, the involved targets are the ones that has been deleted.
            for target in &dev_items.involved_targets {
                prod_records.remove_hash_if_exist(*target)?;
            }

            prod_records
                .persist_hashes(true)
                .context("Error while saving the updated hashes")?;
        }

        Ok(())
    }

    /// Returns a reference to checksums records manager singleton
    pub fn get(production: bool) -> anyhow::Result<&'static ChecksumRecords> {
        static CHECKSUM_RECORDS: OnceLock<anyhow::Result<ChecksumRecords>> = OnceLock::new();

        CHECKSUM_RECORDS
            .get_or_init(|| ChecksumRecords::load(production))
            .as_ref()
            .map_err(|err| anyhow!("{err}"))
    }

    /// Loads the persisted records from checksums file if exist
    fn load(production: bool) -> anyhow::Result<Self> {
        let file_path = Self::get_file_path(production);

        let items = if file_path.exists() {
            let file_content = fs::read_to_string(file_path)?;
            let map = Self::parse_hashes(file_content)?;
            ChecksumItems {
                map,
                involved_targets: BTreeSet::new(),
            }
        } else {
            ChecksumItems::default()
        };

        Ok(Self {
            items: Mutex::new(items),
        })
    }

    /// Gets the path of the file where the checksums are saved
    fn get_file_path(production: bool) -> PathBuf {
        let root = get_root();
        if production {
            root.join(FILE_NAME_PROD)
        } else {
            root.join(FILE_NAME_DEV)
        }
    }

    /// Removes the records file for the given environment
    pub fn remove_records_file(production: bool) -> anyhow::Result<()> {
        let file_path = Self::get_file_path(production);
        if file_path.exists() {
            std::fs::remove_file(&file_path).with_context(|| {
                format!(
                    "Error while removing the file {} to reset checksum records",
                    file_path.display()
                )
            })?;
        }

        Ok(())
    }

    fn parse_hashes(text: String) -> anyhow::Result<BTreeMap<Target, HashDigest>> {
        let mut hashes = BTreeMap::new();

        for (target, hash) in text.lines().filter_map(|line| line.split_once(':')) {
            let target: Target = target.parse()?;
            let hash: HashDigest = hash.parse().map_err(|e| anyhow!("{e}"))?;

            hashes.insert(target, hash);
        }

        Ok(hashes)
    }

    /// Marks the job is involved in the record tracker
    pub fn register_job(&self, target: Target) -> anyhow::Result<()> {
        let mut items = self
            .items
            .lock()
            .map_err(|err| anyhow!("Error while acquiring items jobs mutex: Error {err}"))?;
        items.involved_targets.insert(target);
        Ok(())
    }

    /// Calculate the current checksum for the given target and compare it to the saved one.
    ///
    /// # Panics
    ///
    /// This method panics if the provided target isn't registered
    pub fn compare_checksum(&self, target: Target) -> anyhow::Result<ChecksumCompareResult> {
        let items = self
            .items
            .lock()
            .map_err(|err| anyhow!("Error while acquiring items jobs mutex: Error {err}"))?;

        assert!(items.involved_targets.contains(&target));
        let saved_hash = match items.map.get(&target) {
            Some(hash) => hash,
            // If there is no existing checksum to compare with, then the checksums state has
            // changed.
            None => return Ok(ChecksumCompareResult::Changed),
        };

        let current_hash = Self::calc_hash_for_target(target)?;

        let comparison = if current_hash == *saved_hash {
            ChecksumCompareResult::Same
        } else {
            ChecksumCompareResult::Changed
        };

        Ok(comparison)
    }

    fn calc_hash_for_target(target: Target) -> anyhow::Result<HashDigest> {
        let path = target.cwd();
        calc_combined_checksum(path).with_context(|| {
            format!("Error while calculating the current hash for target: {target}",)
        })
    }

    /// Remove the target from the checksum records
    pub fn remove_hash_if_exist(&self, target: Target) -> anyhow::Result<()> {
        let mut items = self
            .items
            .lock()
            .map_err(|err| anyhow!("Error while acquiring items jobs mutex: Error {err}"))?;

        items.involved_targets.insert(target);

        items.map.remove(&target);

        Ok(())
    }

    fn calculate_involved_hashes(&self) -> anyhow::Result<()> {
        let mut items = self
            .items
            .lock()
            .map_err(|err| anyhow!("Error while acquiring items jobs mutex: Error {err}"))?;

        for target in items.involved_targets.clone() {
            let hash = Self::calc_hash_for_target(target)?;
            match items.map.entry(target) {
                btree_map::Entry::Occupied(mut o) => *o.get_mut() = hash,
                btree_map::Entry::Vacant(e) => _ = e.insert(hash),
            };
        }

        Ok(())
    }

    fn persist_hashes(&self, production: bool) -> anyhow::Result<()> {
        let file_path = Self::get_file_path(production);

        let mut file = File::create(file_path)?;
        let items = self
            .items
            .lock()
            .map_err(|err| anyhow!("Error while acquiring items jobs mutex: Error {err}"))?;

        for (target, hash) in items.map.iter() {
            writeln!(file, "{}:{}", target, hash)?;
        }

        Ok(())
    }
}
