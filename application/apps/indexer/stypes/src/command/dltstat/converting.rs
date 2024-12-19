use crate::*;
use dlt_core::statistics;

impl From<statistics::LevelDistribution> for DltLevelDistribution {
    fn from(v: statistics::LevelDistribution) -> Self {
        DltLevelDistribution {
            non_log: v.non_log,
            log_fatal: v.log_fatal,
            log_error: v.log_error,
            log_warning: v.log_warning,
            log_info: v.log_info,
            log_debug: v.log_debug,
            log_verbose: v.log_verbose,
            log_invalid: v.log_invalid,
        }
    }
}

trait InnerInto<T> {
    fn inner_into(self) -> T;
}

impl InnerInto<Vec<(String, DltLevelDistribution)>>
    for Vec<(String, statistics::LevelDistribution)>
{
    fn inner_into(self) -> Vec<(String, DltLevelDistribution)> {
        self.into_iter().map(|(k, l)| (k, l.into())).collect()
    }
}

impl From<statistics::StatisticInfo> for DltStatisticInfo {
    fn from(v: statistics::StatisticInfo) -> Self {
        DltStatisticInfo {
            app_ids: v.app_ids.inner_into(),
            context_ids: v.context_ids.inner_into(),
            ecu_ids: v.ecu_ids.inner_into(),
            contained_non_verbose: v.contained_non_verbose,
        }
    }
}
