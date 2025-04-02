mod scheme;
mod tys;

use std::collections::HashMap;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub use scheme::*;
pub use tys::*;

#[derive(Default)]
pub struct Components {
    components: HashMap<Uuid, Box<dyn ComponentDescriptor + Send + 'static>>,
}

impl Components {
    pub fn register<D: ComponentDescriptor + Send + 'static>(
        &mut self,
        descriptor: D,
    ) -> Result<(), stypes::NativeError> {
        let ident = descriptor.ident();
        if self.components.contains_key(&ident.uuid) {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("{} ({}) already registred", ident.name, ident.uuid)),
            });
        }
        self.components.insert(ident.uuid, Box::new(descriptor));
        Ok(())
    }

    pub fn get_components(
        &self,
        target: &stypes::ComponentType,
        _source_origin: stypes::SourceOrigin,
    ) -> Result<Vec<stypes::Ident>, stypes::NativeError> {
        // TODO: "ask" source/parser based on origin
        Ok(self
            .components
            .iter()
            .filter_map(|(_, desc)| {
                if desc.is_ty(target) {
                    Some(desc.ident())
                } else {
                    None
                }
            })
            .collect())
    }

    pub fn get_options(
        &self,
        origin: stypes::SourceOrigin,
        mut targets: Vec<Uuid>,
    ) -> Result<HashMap<Uuid, OptionsScheme>, stypes::NativeError> {
        let descriptors: Vec<&Box<dyn ComponentDescriptor + Send + 'static>> = self
            .components
            .iter()
            .filter_map(|(uuid, desc)| {
                if targets.contains(uuid) {
                    targets.retain(|v| v != uuid);
                    Some(desc)
                } else {
                    None
                }
            })
            .collect();
        if !targets.is_empty() {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!(
                    "Fail to find: {}",
                    targets
                        .iter()
                        .map(|v| v.to_string())
                        .collect::<Vec<String>>()
                        .join(", ")
                )),
            });
        }
        let mut list: HashMap<Uuid, OptionsScheme> = HashMap::new();
        for desc in descriptors.into_iter() {
            let mut options = OptionsScheme::new(desc.fields_getter(&origin)?);
            if options.has_lazy() {
                let cancel = CancellationToken::new();
                options.set_lazy(
                    desc.ident(),
                    desc.lazy_fields_getter(origin.clone(), cancel.clone()),
                    &cancel,
                );
            }
            list.insert(desc.ident().uuid, options);
        }
        Ok(list)
    }
}
