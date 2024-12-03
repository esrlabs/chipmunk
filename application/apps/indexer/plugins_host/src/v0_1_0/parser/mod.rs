mod bindings;
mod parser_plugin_state;

use sources::plugins as pl;

use futures::executor::block_on;
use wasmtime::{
    component::{Component, Linker},
    Store,
};
use wasmtime_wasi::ResourceTable;

use crate::{
    plugins_shared::{get_wasi_ctx_builder, plugin_errors::PluginError},
    semantic_version::SemanticVersion,
    wasm_host::get_wasm_host,
    PluginGuestInitError, PluginHostInitError, PluginParseMessage,
};

use self::{bindings::ParsePlugin, parser_plugin_state::ParserPluginState};

pub struct PluginParser {
    store: Store<ParserPluginState>,
    plugin_bindings: ParsePlugin,
}

impl PluginParser {
    pub async fn create(
        component: Component,
        general_config: &pl::PluginParserGeneralSetttings,
        plugin_configs: Vec<pl::ConfigItem>,
    ) -> Result<Self, PluginHostInitError> {
        let engine = get_wasm_host()
            .map(|host| &host.engine)
            .map_err(|err| err.to_owned())?;

        let mut linker: Linker<ParserPluginState> = Linker::new(engine);
        wasmtime_wasi::add_to_linker_async(&mut linker)?;

        ParsePlugin::add_to_linker(&mut linker, |state| state)?;

        let mut ctx = get_wasi_ctx_builder(&plugin_configs)?;
        let resource_table = ResourceTable::new();

        let mut store = Store::new(engine, ParserPluginState::new(ctx.build(), resource_table));

        let (plugin_bindings, _instance) =
            ParsePlugin::instantiate_async(&mut store, &component, &linker).await?;
        let plugin_configs: Vec<_> = plugin_configs.into_iter().map(|item| item.into()).collect();

        plugin_bindings
            .chipmunk_plugin_parser()
            .call_init(&mut store, general_config.into(), &plugin_configs)
            .await?
            .map_err(|guest_err| {
                PluginHostInitError::GuestError(PluginGuestInitError::from(guest_err))
            })?;

        Ok(Self {
            store,
            plugin_bindings,
        })
    }

    pub fn get_config_schemas(&mut self) -> Result<Vec<pl::ConfigSchemaItem>, PluginError> {
        let schemas = block_on(
            self.plugin_bindings
                .chipmunk_plugin_parser()
                .call_get_config_schemas(&mut self.store),
        )?;

        Ok(schemas.into_iter().map(|item| item.into()).collect())
    }

    pub fn plugin_version(&mut self) -> Result<SemanticVersion, PluginError> {
        let version = block_on(
            self.plugin_bindings
                .chipmunk_plugin_parser()
                .call_get_version(&mut self.store),
        )?;

        Ok(version.into())
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
