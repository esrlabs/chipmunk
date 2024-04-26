use std::{
    collections::{btree_map, BTreeMap, BTreeSet},
    fs::{self, File},
    io::Write,
    path::PathBuf,
    sync::Mutex,
};

use anyhow::{anyhow, Context};
use dir_checksum::{calc_combined_checksum, HashDigest};
use tokio::sync::OnceCell;

use crate::{job_type::JobType, location::get_root, target::Target};

const FILE_NAME_DEV: &str = ".build_chksum_dev";
const FILE_NAME_PROD: &str = ".build_chksum_prod";

#[derive(Debug)]
pub struct ChecksumRecords {
    items: Mutex<ChecksumItems>,
    job_type: JobType,
}

#[derive(Debug, Default)]
struct ChecksumItems {
    map: BTreeMap<Target, HashDigest>,
    involved_targets: BTreeSet<Target>,
}

impl ChecksumRecords {
    pub async fn update_and_save(job_type: JobType) -> anyhow::Result<()> {
        let calculate_involved = match &job_type {
            JobType::_Environment | JobType::Lint => return Ok(()),
            JobType::Build { production: _ }
            | JobType::Run { production: _ }
            | JobType::Test { production: _ } => true,
            JobType::Clean { production: _ } => false,
        };

        let records = Self::get(job_type).await?;

        if calculate_involved {
            records.calculate_involved_hashes()?;
        }
        records
            .persist_hashes()
            .context("Error while saving the updated hashes")?;

        Ok(())
    }

    pub async fn get(job_type: JobType) -> anyhow::Result<&'static ChecksumRecords> {
        static CHECKSUM_RECORDS: OnceCell<anyhow::Result<ChecksumRecords>> = OnceCell::const_new();

        CHECKSUM_RECORDS
            .get_or_init(|| async { ChecksumRecords::load(job_type) })
            .await
            .as_ref()
            .map_err(|err| anyhow!("{err}"))
    }

    fn load(job_type: JobType) -> anyhow::Result<Self> {
        let file_path = Self::get_file_path(job_type.is_production().is_some_and(|prod| prod));

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
            job_type,
        })
    }

    fn get_file_path(production: bool) -> PathBuf {
        let root = get_root();
        if production {
            root.join(FILE_NAME_PROD)
        } else {
            root.join(FILE_NAME_DEV)
        }
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

    pub fn register_job(&self, target: Target) {
        let mut items = self.items.lock().unwrap();
        items.involved_targets.insert(target);
    }

    pub fn check_changed(&self, target: Target) -> anyhow::Result<bool> {
        let items = self.items.lock().unwrap();
        assert!(items.involved_targets.contains(&target));
        let saved_hash = match items.map.get(&target) {
            Some(hash) => hash,
            None => return Ok(true),
        };

        let current_hash = Self::calc_hash_for_target(&target)?;

        Ok(current_hash != *saved_hash)
    }

    fn calc_hash_for_target(target: &Target) -> anyhow::Result<HashDigest> {
        let path = target.cwd();
        calc_combined_checksum(path).with_context(|| {
            format!("Error while calculating the current hash for target: {target}",)
        })
    }

    pub fn remove_hash_if_exist(&self, target: Target) {
        let mut items = self.items.lock().unwrap();
        items.involved_targets.insert(target);

        items.map.remove(&target);
    }

    fn calculate_involved_hashes(&self) -> anyhow::Result<()> {
        let mut items = self.items.lock().unwrap();

        for target in items.involved_targets.clone() {
            let hash = Self::calc_hash_for_target(&target)?;
            match items.map.entry(target) {
                btree_map::Entry::Occupied(mut o) => *o.get_mut() = hash,
                btree_map::Entry::Vacant(e) => _ = e.insert(hash),
            };
        }

        Ok(())
    }

    fn persist_hashes(&self) -> anyhow::Result<()> {
        let file_path = Self::get_file_path(self.job_type.is_production().is_some_and(|prod| prod));

        let mut file = File::create(file_path)?;
        let items = self.items.lock().unwrap();

        for (target, hash) in items.map.iter() {
            writeln!(file, "{}:{}", target, hash)?;
        }

        Ok(())
    }
}
