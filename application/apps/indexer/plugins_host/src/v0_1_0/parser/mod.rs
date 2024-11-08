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
    plugins_shared::get_wasi_ctx_builder, wasm_host::get_wasm_host, PluginGuestInitError,
    PluginHostInitError, PluginParseMessage, PluginType, WasmPlugin,
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

    #[allow(unused)]
    #[inline]
    /// Call parse function that returns the result as a collection.
    fn parse_with_list(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = (usize, Option<p::ParseYield<PluginParseMessage>>)>, p::Error>
    {
        let call_res =
            futures::executor::block_on(self.plugin_bindings.chipmunk_plugin_parser().call_parse(
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

        let res = parse_results.into_iter().map(guest_to_host_parse_results);
        Ok(res)
    }

    #[allow(unused)]
    #[inline]
    /// Call parse function that adds the results directly at the host using the add method.
    fn parse_with_add(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = (usize, Option<p::ParseYield<PluginParseMessage>>)>, p::Error>
    {
        debug_assert!(
            self.store.data_mut().results_queue.is_empty(),
            "Host results most be empty at the start of parse call"
        );

        let parse_res = futures::executor::block_on(
            self.plugin_bindings
                .chipmunk_plugin_parser()
                .call_parse_with_add(&mut self.store, input, timestamp),
        )
        .map_err(|call_err| {
            p::Error::Unrecoverable(format!(
                "Call parse on the plugin failed. Error: {call_err}"
            ))
        })?;

        if let Err(parse_err) = parse_res {
            //TODO AAZ: Decide what to do if we have already parsed items.

            if !self.store.data().results_queue.is_empty() {
                self.store.data_mut().results_queue.clear();
                return Err(p::Error::Unrecoverable(format!("Plugin return parse error and submitted parsed items on the same call. Plugin Error: {parse_err}")));
            } else {
                return Err(parse_err.into());
            }
        }

        let parse_results = std::mem::take(&mut self.store.data_mut().results_queue);

        let res = parse_results.into_iter().map(guest_to_host_parse_results);

        Ok(res)
    }
}

fn guest_to_host_parse_results(
    parse_res: ParseReturn,
) -> (usize, Option<p::ParseYield<PluginParseMessage>>) {
    (
        parse_res.consumed as usize,
        parse_res.value.map(|v| v.into()),
    )
}

use parsers as p;
impl p::Parser<PluginParseMessage> for PluginParser {
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = (usize, Option<p::ParseYield<PluginParseMessage>>)>, p::Error>
    {
        // TODO AAZ: We keep both functions for now until we can benchmark them properly.
        // Update: Parsing with add provide slightly better performance currently. But there is no
        // clear winner here because parse with list provides better API but has slightly worse
        // performance.
        //
        // ### Benchmarks results for 500 MB DLT file with default allocator ###
        //
        // # Performance with add method:
        // plugin_parser_producer  time:   [8.7054 s 8.7257 s 8.7566 s]
        // plugin_parser_producer  time:   [8.7059 s 8.7216 s 8.7412 s]
        //
        // # Performance with list:
        // plugin_parser_producer  time:   [9.0579 s 9.0758 s 9.0898 s]
        // plugin_parser_producer  time:   [9.0844 s 9.0964 s 9.1101 s]
        //
        self.parse_with_add(input, timestamp)
        // self.parse_with_list(input, timestamp)
    }
}
