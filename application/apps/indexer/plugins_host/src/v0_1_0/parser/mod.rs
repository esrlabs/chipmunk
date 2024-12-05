mod bindings;
mod parser_plugin_state;

use sources::plugins as pl;

use futures::executor::block_on;
use wasmtime::{
    component::{Component, Linker},
    Store,
};
use wasmtime_wasi::{ResourceTable, WasiCtx, WasiCtxBuilder};

use crate::{
    parser_shared::ParserRenderOptions,
    plugins_shared::{get_wasi_ctx_builder, plugin_errors::PluginError},
    semantic_version::SemanticVersion,
    wasm_host::get_wasm_host,
    PluginGuestInitError, PluginHostInitError, PluginParseMessage,
};

use crate::parser_shared as shared;

use self::{bindings::ParsePlugin, parser_plugin_state::ParserPluginState};

pub struct PluginParser {
    store: Store<ParserPluginState>,
    plugin_bindings: ParsePlugin,
}

// Represents the retrieved static information form parser WASM file.
pub(crate) struct PluginInfo {
    pub version: SemanticVersion,
    pub config_schemas: Vec<pl::ConfigSchemaItem>,
    pub render_options: ParserRenderOptions,
}

impl PluginParser {
    /// Load wasm file temporally to retrieve the static plugin information defined by `wit` file
    pub(crate) async fn get_info(component: Component) -> Result<PluginInfo, PluginError> {
        let ctx = WasiCtxBuilder::new().build();
        let mut parser = Self::create(component, ctx).await?;

        let version = parser.plugin_version().await?;

        let render_options = parser.get_render_options().await?;

        let config_schemas = parser.get_config_schemas().await?;

        Ok(PluginInfo {
            version,
            config_schemas,
            render_options,
        })
    }

    /// Creates a new parser instance without initializing it with custom configurations.
    async fn create(component: Component, ctx: WasiCtx) -> Result<Self, PluginHostInitError> {
        let engine = get_wasm_host()
            .map(|host| &host.engine)
            .map_err(|err| err.to_owned())?;

        let mut linker: Linker<ParserPluginState> = Linker::new(engine);
        wasmtime_wasi::add_to_linker_async(&mut linker)?;

        ParsePlugin::add_to_linker(&mut linker, |state| state)?;

        let resource_table = ResourceTable::new();

        let mut store = Store::new(engine, ParserPluginState::new(ctx, resource_table));

        let (plugin_bindings, _instance) =
            ParsePlugin::instantiate_async(&mut store, &component, &linker).await?;

        Ok(Self {
            store,
            plugin_bindings,
        })
    }

    /// Initialize parser instance with the needed configuration to be used within a parsing
    /// session.
    pub async fn initialize(
        component: Component,
        general_config: &pl::PluginParserGeneralSettings,
        plugin_configs: Vec<pl::ConfigItem>,
    ) -> Result<Self, PluginHostInitError> {
        let mut ctx = get_wasi_ctx_builder(&plugin_configs)?;
        let ctx = ctx.build();

        let mut parser = Self::create(component, ctx).await?;

        let plugin_configs: Vec<_> = plugin_configs.into_iter().map(|item| item.into()).collect();

        parser
            .plugin_bindings
            .chipmunk_plugin_parser()
            .call_init(&mut parser.store, general_config.into(), &plugin_configs)
            .await?
            .map_err(|guest_err| {
                PluginHostInitError::GuestError(PluginGuestInitError::from(guest_err))
            })?;

        Ok(parser)
    }

    pub async fn get_config_schemas(&mut self) -> Result<Vec<pl::ConfigSchemaItem>, PluginError> {
        let schemas = self
            .plugin_bindings
            .chipmunk_plugin_parser()
            .call_get_config_schemas(&mut self.store)
            .await?;

        Ok(schemas.into_iter().map(|item| item.into()).collect())
    }

    pub async fn plugin_version(&mut self) -> Result<SemanticVersion, PluginError> {
        let version = self
            .plugin_bindings
            .chipmunk_plugin_parser()
            .call_get_version(&mut self.store)
            .await?;

        Ok(version.into())
    }

    pub async fn get_render_options(&mut self) -> Result<shared::ParserRenderOptions, PluginError> {
        let options = self
            .plugin_bindings
            .chipmunk_plugin_parser()
            .call_get_render_options(&mut self.store)
            .await?;

        Ok(options.into())
    }
}

use parsers as p;
impl p::Parser<PluginParseMessage> for PluginParser {
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = (usize, Option<p::ParseYield<PluginParseMessage>>)>, p::Error>
    {
        let call_res = block_on(self.plugin_bindings.chipmunk_plugin_parser().call_parse(
            &mut self.store,
            input,
            timestamp,
        ));

        let parse_results = match call_res {
            Ok(results) => results?,
            Err(call_err) => {
                return Err(p::Error::Unrecoverable(format!(
                    "Call parse on the plugin failed. Error: {call_err}"
                )))
            }
        };

        let res = parse_results
            .into_iter()
            .map(|item| (item.consumed as usize, item.value.map(|v| v.into())));
        Ok(res)
    }
}
