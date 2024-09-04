mod bindings;
mod parser_plugin_state;

use std::path::Path;

use sources::plugins::PluginParserGeneralSetttings;
use wasmtime::{
    component::{Component, Linker},
    Store,
};
use wasmtime_wasi::ResourceTable;

use crate::{
    plugins_shared::get_wasi_ctx_builder, v0_1_0::parser::bindings::ParseError,
    wasm_host::get_wasm_host, PluginGuestInitError, PluginHostInitError, PluginParseMessage,
    PluginType, WasmPlugin,
};

use self::{
    bindings::{ParsePlugin, ParseReturn},
    parser_plugin_state::ParserPluginState,
};

pub struct PluginParser {
    store: Store<ParserPluginState>,
    plugin_bindings: ParsePlugin,
}

impl WasmPlugin for PluginParser {
    fn get_type() -> PluginType {
        PluginType::Parser
    }
}

impl PluginParser {
    pub async fn create(
        component: Component,
        general_config: &PluginParserGeneralSetttings,
        config_path: Option<impl AsRef<Path>>,
    ) -> Result<Self, PluginHostInitError> {
        let engine = get_wasm_host()
            .map(|host| &host.engine)
            .map_err(|err| err.to_owned())?;

        let mut linker: Linker<ParserPluginState> = Linker::new(engine);
        wasmtime_wasi::add_to_linker_async(&mut linker)?;

        ParsePlugin::add_to_linker(&mut linker, |state| state)?;

        let mut ctx = get_wasi_ctx_builder(config_path.as_ref())?;
        let resource_table = ResourceTable::new();

        let mut store = Store::new(engine, ParserPluginState::new(ctx.build(), resource_table));

        let (plugin_bindings, _instance) =
            ParsePlugin::instantiate_async(&mut store, &component, &linker).await?;

        let plugin_config_path =
            config_path.map(|path| path.as_ref().to_string_lossy().to_string());
        plugin_bindings
            .chipmunk_plugin_parser()
            .call_init(
                &mut store,
                general_config.into(),
                plugin_config_path.as_deref(),
            )
            .await?
            .map_err(|guest_err| {
                PluginHostInitError::GuestError(PluginGuestInitError::from(guest_err))
            })?;

        Ok(Self {
            store,
            plugin_bindings,
        })
    }

    #[inline]
    /// Call parse function that returns the result as a collection.
    fn _parse_with_list(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> impl IntoIterator<Item = Result<(usize, Option<p::ParseYield<PluginParseMessage>>), p::Error>>
           + Send {
        let call_res =
            futures::executor::block_on(self.plugin_bindings.chipmunk_plugin_parser().call_parse(
                &mut self.store,
                input,
                timestamp,
            ));

        let parse_results = match call_res {
            Ok(results) => results,
            Err(call_err) => {
                vec![Err(ParseError::Unrecoverable(format!(
                    "Call parse on the plugin failed. Error: {call_err}"
                )))]
            }
        };

        parse_results.into_iter().map(guest_to_host_parse_results)
    }

    #[inline]
    /// Call parse function that adds the results directly at the host using the add method.
    fn parse_with_add(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> impl IntoIterator<Item = Result<(usize, Option<p::ParseYield<PluginParseMessage>>), p::Error>>
           + Send {
        debug_assert!(
            self.store.data_mut().results_queue.is_empty(),
            "Host results most be empty at the start of parse call"
        );

        let call_res = futures::executor::block_on(
            self.plugin_bindings
                .chipmunk_plugin_parser()
                .call_parse_with_add(&mut self.store, input, timestamp),
        );

        let parse_results = if let Err(call_err) = call_res {
            vec![Err(ParseError::Unrecoverable(format!(
                "Call parse on the plugin failed. Error: {call_err}"
            )))]
        } else {
            std::mem::take(&mut self.store.data_mut().results_queue)
        };

        parse_results.into_iter().map(guest_to_host_parse_results)
    }
}

fn guest_to_host_parse_results(
    guest_res: Result<ParseReturn, ParseError>,
) -> Result<(usize, Option<p::ParseYield<PluginParseMessage>>), p::Error> {
    match guest_res {
        Ok(parse_res) => Ok((
            parse_res.consumed as usize,
            parse_res.value.map(|v| v.into()),
        )),
        Err(parse_err) => Err(parse_err.into()),
    }
}

use parsers as p;
impl p::Parser<PluginParseMessage> for PluginParser {
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> impl IntoIterator<Item = Result<(usize, Option<p::ParseYield<PluginParseMessage>>), p::Error>>
           + Send {
        // TODO AAZ: We keep both functions for now until we can benchmark them properly.
        self.parse_with_add(input, timestamp)
        // self._parse_with_list(input, timestamp)
    }
}
