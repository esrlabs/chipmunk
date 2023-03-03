use crate::events::ComputationError;
use tokio::sync::oneshot;

pub mod cancel_test;

#[derive(Debug)]
pub enum Job {
    CancelTest(i64, i64, oneshot::Sender<Result<i64, ComputationError>>),
}

impl std::fmt::Display for Job {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Job::CancelTest(_, _, _) => "CancelTest",
            }
        )
    }
}
