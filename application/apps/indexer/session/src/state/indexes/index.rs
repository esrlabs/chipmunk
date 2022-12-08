use super::nature::Nature;

#[derive(Debug)]
pub struct Index {
    pub position: u64,
    pub natures: Vec<Nature>,
}

impl Index {
    pub fn new(position: &u64, nature: &Nature) -> Self {
        Index {
            position: *position,
            natures: vec![*nature],
        }
    }

    pub fn extend(&mut self, nature: &Nature) {
        if self.natures.iter().any(|n| n == nature) {
            return;
        }
        if matches!(nature, Nature::Breadcrumb) && !self.natures.is_empty() {
            // We are define nature as breadcrumbs, only if isn't bound with any other nature
            return;
        }
        self.natures.push(*nature);
    }

    pub fn abbreviate(&mut self, nature: &Nature) -> bool {
        if let Some(i) = self.natures.iter().position(|n| n == nature) {
            self.natures.remove(i);
        }
        self.natures.is_empty()
    }

    pub fn get_natures(&self) -> Vec<u8> {
        self.natures.iter().map(|n| n.as_u8()).collect()
    }

    pub fn includes(&self, nature: &Nature) -> bool {
        self.natures.iter().any(|n| n == nature)
    }
}
