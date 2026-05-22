mod converting;

use crate::*;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct DltLevelDistribution {
    pub non_log: usize,
    pub log_fatal: usize,
    pub log_error: usize,
    pub log_warning: usize,
    pub log_info: usize,
    pub log_debug: usize,
    pub log_verbose: usize,
    pub log_invalid: usize,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct DltStatisticInfo {
    pub app_ids: Vec<(String, DltLevelDistribution)>,
    pub context_ids: Vec<(String, DltLevelDistribution)>,
    pub ecu_ids: Vec<(String, DltLevelDistribution)>,
    pub contained_non_verbose: bool,
}
