//! Include structures and implementation of parser plugins for API version 0.1.0
//! as defined in WIT files.

mod bindings;
mod parser_plugin_state;

use stypes::{ParserRenderOptions, RenderOptions, SemanticVersion};
use tokio::runtime::Handle;
use wasmtime::{
    Store,
    component::{Component, Linker},
};
use wasmtime_wasi::{ResourceTable, p2::WasiCtx};

use crate::{
    PluginGuestError, PluginHostError, PluginParseMessage,
    plugins_shared::{PluginInfo, get_wasi_ctx_builder, plugin_errors::PluginError},
    wasm_host::get_wasm_host,
};

use self::{bindings::Parse, parser_plugin_state::ParserPluginState};

/// Host of the parser plugin for plugins API version 0.1.0
pub struct PluginParser {
    store: Store<ParserPluginState>,
    plugin_bindings: Parse,
}

impl PluginParser {
    /// Load wasm file temporally to retrieve the static plugin information defined by `wit` file
    pub(crate) async fn get_info(component: Component) -> Result<PluginInfo, PluginError> {
        let mut ctx = get_wasi_ctx_builder(&[])?;
        let ctx = ctx.build();

        let mut parser = Self::create(component, ctx).await?;

        let version = parser.plugin_version().await?;

        let render_options = parser.get_render_options().await?;

        let config_schemas = parser.get_config_schemas().await?;

        Ok(PluginInfo {
            version,
            config_schemas,
            render_options: RenderOptions::Parser(Box::new(render_options)),
        })
    }

    /// Creates a new parser instance without initializing it with custom configurations.
    async fn create(component: Component, ctx: WasiCtx) -> Result<Self, PluginHostError> {
        let engine = get_wasm_host()
            .map(|host| &host.engine)
            .map_err(|err| err.to_owned())?;

        let mut linker: Linker<ParserPluginState> = Linker::new(engine);
        wasmtime_wasi::p2::add_to_linker_async(&mut linker)?;

        Parse::add_to_linker(&mut linker, |state| state)?;

        let resource_table = ResourceTable::new();

        let mut store = Store::new(engine, ParserPluginState::new(ctx, resource_table));

        let plugin_bindings = Parse::instantiate_async(&mut store, &component, &linker).await?;

        Ok(Self {
            store,
            plugin_bindings,
        })
    }

    /// Initialize parser instance with the needed configuration to be used within a parsing
    /// session.
    pub async fn initialize(
        component: Component,
        general_config: &stypes::PluginParserGeneralSettings,
        plugin_configs: Vec<stypes::PluginConfigItem>,
    ) -> Result<Self, PluginHostError> {
        let mut ctx = get_wasi_ctx_builder(&plugin_configs)?;
        let ctx = ctx.build();

        let mut parser = Self::create(component, ctx).await?;

        let plugin_configs: Vec<_> = plugin_configs.into_iter().map(|item| item.into()).collect();

        parser
            .plugin_bindings
            .chipmunk_parser_parser()
            .call_init(&mut parser.store, general_config.into(), &plugin_configs)
            .await?
            .map_err(|guest_err| PluginHostError::GuestError(PluginGuestError::from(guest_err)))?;

        Ok(parser)
    }

    /// Request configuration schemas from the plugin Guest.
    pub async fn get_config_schemas(
        &mut self,
    ) -> Result<Vec<stypes::PluginConfigSchemaItem>, PluginError> {
        let schemas = self
            .plugin_bindings
            .chipmunk_parser_parser()
            .call_get_config_schemas(&mut self.store)
            .await?;

        Ok(schemas.into_iter().map(|item| item.into()).collect())
    }

    /// Requests plugins version from plugin Guest.
    pub async fn plugin_version(&mut self) -> Result<SemanticVersion, PluginError> {
        let version = self
            .plugin_bindings
            .chipmunk_parser_parser()
            .call_get_version(&mut self.store)
            .await?;

        Ok(version.into())
    }

    /// Requests render options from parser plugin Guest.
    pub async fn get_render_options(&mut self) -> Result<ParserRenderOptions, PluginError> {
        let options = self
            .plugin_bindings
            .chipmunk_parser_parser()
            .call_get_render_options(&mut self.store)
            .await?;

        Ok(options.into())
    }
}

use parsers as p;
impl p::Parser for PluginParser {
    type Output = PluginParseMessage;
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = p::ParseOutput<PluginParseMessage>>, p::Error> {
        // Calls on plugins must be async. To solve that we got the following solutions:
        // - `futures::executor::block_on(plugin_call)`: Blocks the current Tokio worker with a local
        //   executor. Risks are with blocking the whole runtime as Tokio isn't notified.
        // - `block_in_place(|| Handle::current().block_on(plugin_call))`: (Current method)
        //   `block_in_place` informs Tokio this thread will block, allowing scheduler adjustments.
        //   `Handle::block_on` then runs the plugin on Tokio, blocking this thread until completion.

        let call_res = tokio::task::block_in_place(|| {
            Handle::current().block_on(self.plugin_bindings.chipmunk_parser_parser().call_parse(
                &mut self.store,
                input,
                timestamp,
            ))
        });

        let parse_results = match call_res {
            Ok(results) => results?,
            Err(call_err) => {
                // Wasmtime uses anyhow error, which provides error context in debug print only.
                return Err(p::Error::Unrecoverable(format!(
                    "Call parse on the plugin failed. Error: {call_err:?}"
                )));
            }
        };

        let res = parse_results
            .into_iter()
            .map(|item| p::ParseOutput::new(item.consumed as usize, item.value.map(|v| v.into())));
        Ok(res)
    }
}
