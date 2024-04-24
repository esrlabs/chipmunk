use std::{
    collections::BTreeMap,
    fs::{self, File},
    io::Write,
    path::PathBuf,
    sync::Mutex,
};

use anyhow::{anyhow, Context};
use dir_checksum::{calc_combined_checksum, HashDigest};
use tokio::sync::OnceCell;

use crate::{location::get_root, target::Target};

const FILE_NAME_DEV: &'static str = ".build_chksum_dev";
const FILE_NAME_PROD: &'static str = ".build_chksum_prod";

#[derive(Debug)]
pub struct ChecksumRecords {
    items: Mutex<BTreeMap<Target, HashDigest>>,
    production: bool,
}

impl ChecksumRecords {
    pub async fn get(production: bool) -> anyhow::Result<&'static ChecksumRecords> {
        static CHECKSUM_RECORDS: OnceCell<anyhow::Result<ChecksumRecords>> = OnceCell::const_new();

        CHECKSUM_RECORDS
            .get_or_init(|| async { ChecksumRecords::load(production) })
            .await
            .as_ref()
            .map_err(|err| anyhow!("{err}"))
    }

    fn load(production: bool) -> anyhow::Result<Self> {
        let file_path = Self::get_file_path(production);

        let items = if file_path.exists() {
            let file_content = fs::read_to_string(file_path)?;
            Self::parse_hashes(file_content)?
        } else {
            BTreeMap::new()
        };

        return Ok(Self {
            items: Mutex::new(items),
            production,
        });
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

    pub fn _check_changed(&self, target: &Target) -> anyhow::Result<bool> {
        let items = self.items.lock().unwrap();
        let saved_hash = match items.get(target) {
            Some(hash) => hash,
            None => return Ok(true),
        };

        let current_hash = Self::calc_hash_for_target(target)?;

        Ok(current_hash != *saved_hash)
    }

    fn calc_hash_for_target(target: &Target) -> anyhow::Result<HashDigest> {
        let path = target.get().cwd();
        calc_combined_checksum(path).with_context(|| {
            format!("Error while calculating the current hash for target: {target}",)
        })
    }

    pub fn update_and_save(&self) -> anyhow::Result<()> {
        self.calculate_hashes()?;
        self.persist_hashes()
            .context("Error while saving the updated hashes")?;

        Ok(())
    }

    pub fn remove_hash_if_exist(&self, target: &Target) {
        let mut items = self.items.lock().unwrap();
        _ = items.remove(target);
    }

    fn calculate_hashes(&self) -> anyhow::Result<()> {
        let mut calcuated_map = BTreeMap::new();
        for target in Target::all_enums() {
            let hash = Self::calc_hash_for_target(&target)?;
            calcuated_map.insert(target, hash);
        }

        let mut items = self.items.lock().unwrap();
        *items = calcuated_map;

        Ok(())
    }

    fn persist_hashes(&self) -> anyhow::Result<()> {
        let file_path = Self::get_file_path(self.production);

        let mut file = File::create(file_path)?;
        let items = self.items.lock().unwrap();

        for (target, hash) in items.iter() {
            writeln!(file, "{}:{}", target, hash)?;
        }

        Ok(())
    }
}
