mod scheme;
mod tys;

use std::{collections::HashMap, fmt};
use stypes::SessionDescriptor;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub use scheme::*;
pub use tys::*;

pub struct Components<S, P> {
    components: HashMap<Uuid, Entry<S, P>>,
}

impl<S, P> Components<S, P> {
    pub fn new() -> Self {
        Self {
            components: HashMap::new(),
        }
    }
    pub fn add_parser<D: ComponentFactory<P> + 'static>(
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
        self.components
            .insert(ident.uuid, Entry::Parser(Box::new(descriptor)));
        Ok(())
    }
    pub fn add_source<D: ComponentFactory<S> + 'static>(
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
        self.components
            .insert(ident.uuid, Entry::Source(Box::new(descriptor)));
        Ok(())
    }

    pub fn get_components(
        &self,
        target: &stypes::ComponentType,
        origin: stypes::SessionAction,
    ) -> Result<Vec<stypes::Ident>, stypes::NativeError> {
        Ok(self
            .components
            .iter()
            .filter_map(|(_, desc)| match target {
                stypes::ComponentType::Parser => {
                    if let Entry::Parser(desc) = desc {
                        if desc.is_compatible(&origin) {
                            Some(desc.ident())
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                }
                stypes::ComponentType::Source => {
                    if let Entry::Source(desc) = desc {
                        if desc.is_compatible(&origin) {
                            Some(desc.ident())
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                }
            })
            .collect())
    }

    pub fn get_options(
        &self,
        origin: stypes::SessionAction,
        mut targets: Vec<Uuid>,
    ) -> Result<HashMap<Uuid, OptionsScheme>, stypes::NativeError> {
        let descriptors: Vec<&Entry<S, P>> = self
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

    pub fn get_output_render(
        &self,
        uuid: &Uuid,
    ) -> Result<Option<stypes::OutputRender>, stypes::NativeError> {
        let Entry::Parser(descriptor) = self.components.get(&uuid).ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Configuration,
            message: Some(format!("Fail to find component {uuid}")),
        })?
        else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!(
                    "Fail to get render for {uuid}, because it isn't parser"
                )),
            });
        };
        Ok(descriptor.get_render())
    }

    pub fn validate(
        &self,
        origin: &stypes::SessionAction,
        target: &Uuid,
        fields: &[stypes::Field],
    ) -> Result<HashMap<String, String>, stypes::NativeError> {
        let descriptor = self.components.get(target).ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Configuration,
            message: Some(format!("Fail to find component {target}")),
        })?;
        Ok(descriptor.validate(origin, fields))
    }

    pub fn setup(
        &self,
        options: &stypes::SessionSetup,
    ) -> Result<(SessionDescriptor, S, P), stypes::NativeError> {
        let Some(Entry::Parser(parser)) = self.components.get(&options.parser.uuid) else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to find parser {}", options.parser.uuid)),
            });
        };
        let Some(Entry::Source(source)) = self.components.get(&options.source.uuid) else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to find source {}", options.source.uuid)),
            });
        };
        let desciptor = SessionDescriptor::new(
            source.bound_ident(&options.origin, &options.source.fields),
            source.bound_ident(&options.origin, &options.parser.fields),
        );
        let Some(parser) = parser.create(&options.origin, &options.parser.fields)? else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to init parser {}", options.parser.uuid)),
            });
        };
        let Some(source) = source.create(&options.origin, &options.source.fields)? else {
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Configuration,
                message: Some(format!("Fail to init source {}", options.source.uuid)),
            });
        };
        Ok((desciptor, source, parser))
    }
}

impl<S, P> fmt::Debug for Components<S, P> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Components")
    }
}
