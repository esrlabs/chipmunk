use crate::*;
use serde::{Deserialize, Serialize};

pub type GrabbedElementList = Vec<GrabbedElement>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GrabbedElement {
    pub source_id: u16,
    pub content: String,
    pub pos: usize,
    pub nature: u8,
}

impl TryFrom<grabbing::GrabbedElement> for GrabbedElement {
    type Error = E;
    fn try_from(v: grabbing::GrabbedElement) -> Result<Self, Self::Error> {
        Ok(GrabbedElement {
            source_id: v.source_id as u16,
            content: v.content,
            pos: v.pos as usize,
            nature: v.nature as u8,
        })
    }
}

impl TryFrom<grabbing::GrabbedElementList> for GrabbedElementList {
    type Error = E;
    fn try_from(v: grabbing::GrabbedElementList) -> Result<Self, Self::Error> {
        let mut els = Vec::new();
        for el in v.elements.into_iter() {
            els.push(el.try_into()?);
        }
        Ok(els)
    }
}
