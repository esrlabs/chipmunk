use crate::*;

impl GrabbedElement {
    pub fn set_nature(&mut self, nature: u8) {
        self.nature = nature;
    }
}

impl FilterMatch {
    pub fn new(index: u64, filters: Vec<u8>) -> Self {
        Self { index, filters }
    }
}
