use crate::*;

impl Ticks {
    pub fn done(&self) -> bool {
        match self.total {
            Some(total) => self.count == total,
            None => false,
        }
    }
}
