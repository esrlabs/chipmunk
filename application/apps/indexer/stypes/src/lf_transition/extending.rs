use crate::*;

impl LifecycleTransition {
    pub fn uuid(&self) -> Uuid {
        match self {
            Self::Started { uuid, alias: _ } => *uuid,
            Self::Ticks { uuid, ticks: _ } => *uuid,
            Self::Stopped(uuid) => *uuid,
        }
    }

    pub fn started(uuid: &Uuid, alias: &str) -> Self {
        LifecycleTransition::Started {
            uuid: *uuid,
            alias: alias.to_owned(),
        }
    }

    pub fn stopped(uuid: &Uuid) -> Self {
        LifecycleTransition::Stopped(*uuid)
    }

    pub fn ticks(uuid: &Uuid, ticks: Ticks) -> Self {
        LifecycleTransition::Ticks { uuid: *uuid, ticks }
    }
}
