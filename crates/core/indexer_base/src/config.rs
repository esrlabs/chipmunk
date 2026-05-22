// Copyright (c) 2020 E.S.R.Labs. All rights reserved.
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
use serde::{Deserialize, Serialize};
use std::ops::RangeInclusive;

/// A IndexSection describes a section of a file by indicies
/// to identify lines 10-12 (inclusively) => first_line = 10, last_line = 12
/// to identify only line 13: first_line = 13, last_line = 13
#[derive(Serialize, Deserialize, Debug)]
pub struct IndexSection {
    pub first_line: usize,
    pub last_line: usize,
}

impl IndexSection {
    pub fn len(&self) -> usize {
        self.last_line - self.first_line + 1
    }

    pub fn is_empty(&self) -> bool {
        (self.len() == 0) || ((self.last_line + self.first_line) == 0)
    }

    pub fn left(&mut self, offset: usize) {
        self.first_line = self.first_line.saturating_sub(offset);
        self.last_line = self.last_line.saturating_sub(offset);
    }

    pub fn from(range: &RangeInclusive<u64>) -> Self {
        Self {
            first_line: (*range.start()) as usize,
            last_line: (*range.end()) as usize,
        }
    }
}
