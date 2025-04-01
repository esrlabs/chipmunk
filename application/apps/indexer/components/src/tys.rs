use std::{future::Future, pin::Pin};

use crate::*;
use tokio_util::sync::CancellationToken;

pub type FieldsResult = Result<Vec<stypes::FieldDesc>, stypes::NativeError>;

pub type StaticFieldResult = (String, Result<stypes::StaticFieldDesc, String>);

pub type StaticFieldsResult = Result<Vec<StaticFieldResult>, stypes::NativeError>;

pub type LazyFieldsTask = Pin<Box<dyn Future<Output = StaticFieldsResult> + Send>>;

pub trait Component {
    /// Registration
    fn register(components: &mut Components) -> Result<(), stypes::NativeError>;
}

pub trait ComponentDescriptor {
    fn ident(&self) -> stypes::Ident;
    fn ty(&self) -> stypes::ComponentType;
    fn is_ty(&self, ty: &stypes::ComponentType) -> bool {
        &self.ty() == ty
    }
    #[allow(unused)]
    fn fields_getter(&self, origin: &stypes::SourceOrigin) -> FieldsResult {
        Ok(Vec::new())
    }
    #[allow(unused)]
    fn lazy_fields_getter(
        &self,
        origin: stypes::SourceOrigin,
        cancel: CancellationToken,
    ) -> LazyFieldsTask {
        Box::pin(async { Ok(Vec::new()) })
    }
    #[allow(unused)]
    fn validate(
        &self,
        origin: &stypes::SourceOrigin,
        fields: &[stypes::Field],
    ) -> HashMap<String, String> {
        HashMap::new()
    }
}
