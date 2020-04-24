// Copyright (c) 2019 E.S.R.Labs. All rights reserved.
//
// NOTICE:  All information contained herein is, and remains
// the property of E.S.R.Labs and its suppliers, if any.
// The intellectual and technical concepts contained herein are
// proprietary to E.S.R.Labs and its suppliers and may be covered
// by German and Foreign Patents, patents in process, and are protected
// by trade secret or copyright law.
// Dissemination of this information or reproduction of this material
// is strictly forbidden unless prior written permission is obtained
// from E.S.R.Labs.
use crate::progress::Severity;
use log::*;
use rustc_hash::FxHashMap;
use serde::Serialize;
use std::borrow::Cow;

type IncidentMap = FxHashMap<String, usize>;

#[derive(Serialize, Debug)]
pub struct Incident<'a> {
    severity: Severity,
    text: Cow<'a, str>,
    line_nr: Option<usize>,
}
impl<'a> Incident<'a> {
    pub fn new<S: Into<Cow<'a, str>>>(
        severity: Severity,
        raw: S,
        line_nr: Option<usize>,
    ) -> Incident<'a> {
        Incident {
            severity,
            text: raw.into(),
            line_nr,
        }
    }
}

#[derive(Default)]
pub struct Reporter {
    warning_incidents: IncidentMap,
    error_incidents: IncidentMap,
}

impl Reporter {
    pub fn add_to_report(self: &mut Reporter, severity: Severity, text: String) {
        match severity {
            Severity::WARNING => {
                if let Some(n) = self.warning_incidents.get_mut(&text) {
                    *n += 1
                } else {
                    self.warning_incidents.insert(text, 1);
                }
            }
            Severity::ERROR => {
                if let Some(n) = self.error_incidents.get_mut(&text) {
                    *n += 1
                } else {
                    self.error_incidents.insert(text, 1);
                }
            }
        }
    }
    pub fn flush(self: &mut Reporter) {
        for (error, count) in self.error_incidents.iter() {
            report_error(format!("{} ({} times)", error, count));
        }
        self.error_incidents.clear();
        for (warning, count) in self.warning_incidents.iter() {
            report_warning(format!("{} ({} times)", warning, count));
        }
        self.warning_incidents.clear();
    }
}
pub fn report_warning<'a, S: Into<Cow<'a, str>>>(text: S) {
    let incident = Incident::new(Severity::WARNING, text, None);
    warn!(
        "{}",
        serde_json::to_string(&incident).unwrap_or_else(|_| "".to_string())
    )
}
pub fn report_warning_ln<'a, S: Into<Cow<'a, str>>>(text: S, line_nr: Option<usize>) {
    warn!("{}", create_incident(Severity::WARNING, text, line_nr))
}
pub fn report_error<'a, S: Into<Cow<'a, str>>>(text: S) {
    error!("{}", create_incident(Severity::ERROR, text, None))
}
pub fn report_error_ln<'a, S: Into<Cow<'a, str>>>(text: S, line_nr: Option<usize>) {
    error!("{}", create_incident(Severity::ERROR, text, line_nr))
}
fn create_incident<'a, S: Into<Cow<'a, str>>>(
    severity: Severity,
    text: S,
    line_nr: Option<usize>,
) -> String {
    let incident = Incident::new(severity, text, line_nr);
    serde_json::to_string(&incident).unwrap_or_else(|_| "".to_string())
}
