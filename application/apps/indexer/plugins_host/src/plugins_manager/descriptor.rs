use components::{ComponentDescriptor, ComponentFactory};
use stypes::{
    Field, NativeError, NativeErrorKind, PluginConfigItem, PluginEntity, PluginParserSettings,
    SessionAction, Severity, StaticFieldDesc,
};
use tokio::runtime::Handle;
use tokio_util::sync::CancellationToken;

use crate::PluginsParser;

#[derive(Debug)]
pub struct PluginDescriptor {
    entity: PluginEntity,
}

impl PluginDescriptor {
    pub fn new(entity: PluginEntity) -> Self {
        Self { entity }
    }
}

impl ComponentDescriptor for PluginDescriptor {
    fn ident(&self) -> stypes::Ident {
        let desc = self
            .entity
            .metadata
            .description
            .as_ref()
            .map_or_else(|| String::from("Parser Plugin"), |desc| desc.to_owned());
        stypes::Ident {
            name: self.entity.metadata.title.to_owned(),
            desc,
            io: stypes::IODataType::Any,
            uuid: uuid::Uuid::new_v4(),
        }
    }

    fn ty(&self) -> stypes::ComponentType {
        match self.entity.plugin_type {
            stypes::PluginType::Parser => stypes::ComponentType::Parser,
            stypes::PluginType::ByteSource => stypes::ComponentType::Source,
        }
    }

    fn get_render(&self) -> Option<stypes::OutputRender> {
        // TODO AAZ: API on plugins should change to match this changes.
        match &self.entity.info.render_options {
            stypes::RenderOptions::Parser(parser_render_options) => {
                if let Some(opts) = parser_render_options.columns_options.as_ref() {
                    let cols: Vec<_> = opts
                        .columns
                        .iter()
                        .map(|col| (col.caption.to_owned(), col.width as usize))
                        .collect();
                    Some(stypes::OutputRender::Columns(cols))
                } else {
                    Some(stypes::OutputRender::PlaitText)
                }
            }
            stypes::RenderOptions::ByteSource => None,
        }
    }

    fn bound_ident(
        &self,
        _origin: &stypes::SessionAction,
        _fields: &[stypes::Field],
    ) -> stypes::Ident {
        self.ident()
    }

    fn is_ty(&self, ty: &stypes::ComponentType) -> bool {
        &self.ty() == ty
    }

    fn fields_getter(&self, _origin: &stypes::SessionAction) -> components::FieldsResult {
        let fields: Vec<_> = self
            .entity
            .info
            .config_schemas
            .iter()
            .map(|conf| {
                use stypes::PluginConfigSchemaType as SchType;
                use stypes::ValueInput as InType;
                let interface = match &conf.input_type {
                    SchType::Boolean(bool) => InType::Checkbox(*bool),
                    SchType::Integer(num) => InType::Number(*num as i64),
                    //TODO AAZ: Clarify why we don't have float numbers.
                    SchType::Float(num) => InType::Number(*num as i64),
                    SchType::Text(def_txt) => InType::String(def_txt.to_owned(), String::new()),
                    SchType::Directories => InType::Directories,
                    SchType::Files(items) => InType::Files(items.to_vec()),
                    SchType::Dropdown(items) => {
                        InType::Strings(items.0.to_owned(), items.1.to_owned())
                    }
                };
                let static_desc = StaticFieldDesc {
                    id: conf.id.to_owned(),
                    name: conf.title.to_owned(),
                    desc: conf
                        .description
                        .as_ref()
                        .map_or_else(|| String::new(), |d| d.to_owned()),
                    //TODO AAZ: Map this to plugins API
                    required: true,
                    interface,
                    binding: None,
                };
                stypes::FieldDesc::Static(static_desc)
            })
            .collect();

        Ok(fields)
    }

    fn lazy_fields_getter(
        &self,
        _origin: stypes::SessionAction,
        _cancel: CancellationToken,
    ) -> components::LazyFieldsTask {
        Box::pin(async { Ok(Vec::new()) })
    }

    fn validate(
        &self,
        _origin: &stypes::SessionAction,
        _fields: &[stypes::Field],
    ) -> Result<std::collections::HashMap<String, String>, stypes::NativeError> {
        Ok(std::collections::HashMap::new())
    }

    fn is_compatible(&self, _origin: &stypes::SessionAction) -> bool {
        true
    }
}

impl ComponentFactory<parsers::Parser> for PluginDescriptor {
    fn create(
        &self,
        origin: &SessionAction,
        options: &[Field],
    ) -> Result<Option<(parsers::Parser, Option<String>)>, NativeError> {
        let errors = self.validate(origin, options)?;
        if !errors.is_empty() {
            return Err(NativeError {
                kind: NativeErrorKind::Configuration,
                severity: Severity::ERROR,
                message: Some(
                    errors
                        .values()
                        .map(String::as_str)
                        .collect::<Vec<_>>()
                        .join("; "),
                ),
            });
        }

        let configs: Vec<PluginConfigItem> = options
            .iter()
            .map(|opt| {
                use stypes::PluginConfigValue as PlVal;

                let val = match opt.value.clone() {
                    stypes::Value::Boolean(val) => PlVal::Boolean(val),
                    stypes::Value::Number(num) => PlVal::Integer(num as i32),
                    stypes::Value::String(txt) => PlVal::Text(txt),
                    stypes::Value::Directories(path_bufs) => PlVal::Directories(path_bufs),
                    stypes::Value::Files(path_bufs) => PlVal::Files(path_bufs),
                    unsupported => panic!("Config {unsupported:?} is unsupported by plugins"),
                };
                PluginConfigItem::new(opt.id.to_owned(), val)
            })
            .collect();

        let settings =
            PluginParserSettings::new(self.entity.dir_path.to_owned(), Default::default(), configs);

        //TODO AAZ: Temp solution by blocking here.
        //Create function should be async
        let parse_res = tokio::task::block_in_place(move || {
            Handle::current().block_on(async move {
                PluginsParser::initialize(
                    &settings.plugin_path,
                    &settings.general_settings,
                    settings.plugin_configs.clone(),
                )
                .await
            })
        })?;

        let parser = parsers::Parser::Plugin(Box::new(parse_res));

        Ok(Some((parser, Some(self.entity.metadata.title.to_owned()))))
    }
}

impl ComponentFactory<sources::Source> for PluginDescriptor {
    fn create(
        &self,
        _origin: &SessionAction,
        _options: &[Field],
    ) -> Result<Option<(sources::Source, Option<String>)>, NativeError> {
        //TODO: Update once sources are implemented
        Err(NativeError {
            severity: Severity::WARNING,
            kind: NativeErrorKind::NotYetImplemented,
            message: Some("Support for sources isn't implemented yet".into()),
        })
    }
}
