use proto::*;
use session::state::GrabbedElement;
use std::{mem, ops::Deref};

pub struct GrabbedElements(pub Vec<GrabbedElement>);

impl Deref for GrabbedElements {
    type Target = Vec<GrabbedElement>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl From<GrabbedElements> for Vec<u8> {
    fn from(mut val: GrabbedElements) -> Self {
        let els = mem::take(&mut val.0);
        let elements: Vec<grabbing::GrabbedElement> = els
            .into_iter()
            .map(|mut el| grabbing::GrabbedElement {
                source_id: mem::take(&mut el.source_id) as u32,
                content: mem::take(&mut el.content),
                nature: mem::take(&mut el.nature) as u32,
                pos: mem::take(&mut el.pos) as u64,
            })
            .collect();
        let list = grabbing::GrabbedElementList { elements };
        prost::Message::encode_to_vec(&list)
    }
}
