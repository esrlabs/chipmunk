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
use serde::Serialize;
use std::borrow::Cow;

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

#[derive(Serialize, Debug)]
pub enum Severity {
    WARNING,
    ERROR,
}
#[derive(Default)]
pub struct Reporter {
    warnings: Vec<String>,
    errors: Vec<String>,
}

impl Reporter {
    pub fn add_to_report(self: &mut Reporter, severity: Severity, text: String) {
        match severity {
            Severity::WARNING => self.warnings.push(text),
            Severity::ERROR => self.errors.push(text),
        }
    }
    pub fn flush(self: &mut Reporter) {
        if !self.errors.is_empty() {
            report_warning(self.errors.join("\n"));
            self.errors.clear();
        }
        if !self.warnings.is_empty() {
            report_warning(self.warnings.join("\n"));
            self.warnings.clear();
        }
    }
}
pub fn report_warning<'a, S: Into<Cow<'a, str>>>(text: S) {
    let incident = Incident::new(Severity::WARNING, text, None);
    eprintln!(
        "{}",
        serde_json::to_string(&incident).unwrap_or_else(|_| "".to_string())
    )
}
pub fn report_warning_ln<'a, S: Into<Cow<'a, str>>>(text: S, line_nr: usize) {
    eprintln!(
        "{}",
        create_incident(Severity::WARNING, text, Some(line_nr))
    )
}
pub fn report_error<'a, S: Into<Cow<'a, str>>>(text: S) {
    eprintln!("{}", create_incident(Severity::ERROR, text, None))
}
pub fn report_error_ln<'a, S: Into<Cow<'a, str>>>(text: S, line_nr: usize) {
    eprintln!("{}", create_incident(Severity::ERROR, text, Some(line_nr)))
}
fn create_incident<'a, S: Into<Cow<'a, str>>>(
    severity: Severity,
    text: S,
    line_nr: Option<usize>,
) -> String {
    let incident = Incident::new(severity, text, line_nr);
    serde_json::to_string(&incident).unwrap_or_else(|_| "".to_string())
}
