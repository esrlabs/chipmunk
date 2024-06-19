use flatbuffers::{FlatBufferBuilder, WIPOffset};
use protocol;
use session::state::GrabbedElement;
use std::ops::Deref;

pub struct GrabbedElementWrapper(GrabbedElement);

impl Deref for GrabbedElementWrapper {
    type Target = GrabbedElement;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl From<GrabbedElementWrapper> for Vec<i32> {
    fn from(val: GrabbedElementWrapper) -> Self {
        let mut builder = FlatBufferBuilder::new();
        let content = builder.create_string(&val.content);
        let el = protocol::GrabbedElement::create(
            &mut builder,
            &protocol::GrabbedElementArgs {
                source_id: val.source_id,
                pos: val.pos as u64,
                nature: val.nature,
                content: Some(content),
            },
        );
        builder.finish(el, None);
        builder.finished_data().iter().map(|v| *v as i32).collect()
    }
}

pub struct GrabbedElements(pub Vec<GrabbedElement>);

impl Deref for GrabbedElements {
    type Target = Vec<GrabbedElement>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl From<GrabbedElements> for Vec<i32> {
    fn from(val: GrabbedElements) -> Self {
        let mut builder = FlatBufferBuilder::new();
        let els: Vec<WIPOffset<protocol::GrabbedElement>> = val
            .iter()
            .map(|el| {
                let content = builder.create_string(&el.content);
                protocol::GrabbedElement::create(
                    &mut builder,
                    &protocol::GrabbedElementArgs {
                        source_id: el.source_id,
                        pos: el.pos as u64,
                        nature: el.nature,
                        content: Some(content),
                    },
                )
            })
            .collect();
        let elements = builder.create_vector(&els);
        let args = protocol::GrabbedElementListArgs {
            elements: Some(elements),
        };
        let holder = protocol::GrabbedElementList::create(&mut builder, &args);
        builder.finish(holder, None);
        builder.finished_data().iter().map(|v| *v as i32).collect()
    }
}
