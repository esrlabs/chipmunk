use criterion::{criterion_group, criterion_main, BatchSize, Criterion};
use plugins_host::PluginsParser;
use std::{hint::black_box, path::PathBuf};
use stypes::{PluginConfigItem, PluginConfigValue};

use bench_utls::{
    bench_standrad_config, create_binary_bytesource, get_config, read_binary, run_producer,
};
use sources::producer::MessageProducer;

mod bench_utls;

/// This benchmark covers parsing the given file using a plugin parser.
/// The path for the plugin is provided via the additional configuration environment variable.
/// Plugin parser will run using the default prototyping configuration temporally.
fn plugin_parser_producer(c: &mut Criterion) {
    let data = read_binary();

    // Additional configuration are assumed to be the path for the parser plugin binary.
    let plugin_path = get_config()
        .map(PathBuf::from)
        .expect("Path to plugin must be provided as additional config");

    //TODO: Deliver plugin configurations for benchmarks.
    //For now we are delivering hard-coded configurations of string parser and DLT plugins.
    // let plugin_configs = get_string_parser_configs();
    let plugin_configs = get_dlt_parser_configs();

    let settings = stypes::PluginParserSettings::new(
        plugin_path,
        stypes::PluginParserGeneralSettings::default(),
        plugin_configs,
    );

    c.bench_function("plugin_parser_producer", |bencher| {
        bencher
            .to_async(tokio::runtime::Runtime::new().unwrap())
            .iter_batched(
                || {
                    let parser = futures::executor::block_on(PluginsParser::initialize(
                        &settings.plugin_path,
                        &settings.general_settings,
                        settings.plugin_configs.clone(),
                    ))
                    .unwrap();

                    let source = create_binary_bytesource(data);
                    let producer = MessageProducer::new(parser, source, black_box(None));

                    producer
                },
                |p| run_producer(p),
                BatchSize::SmallInput,
            )
    });
}

#[allow(dead_code)]
fn get_string_parser_configs() -> Vec<PluginConfigItem> {
    const LOSSY_ID: &str = "lossy";
    const PREFIX_ID: &str = "prefix";
    vec![
        PluginConfigItem::new(LOSSY_ID, PluginConfigValue::Boolean(false)),
        PluginConfigItem::new(PREFIX_ID, PluginConfigValue::Text(String::default())),
    ]
}

#[allow(dead_code)]
fn get_dlt_parser_configs() -> Vec<PluginConfigItem> {
    const LOG_LEVEL_ID: &str = "log_level";
    const FIBEX_ID: &str = "fibex_id";
    const STORAGE_HEADER_ID: &str = "storage_header_id";
    vec![
        PluginConfigItem::new(LOG_LEVEL_ID, PluginConfigValue::Dropdown("Verbose".into())),
        PluginConfigItem::new(FIBEX_ID, PluginConfigValue::Files(Vec::new())),
        PluginConfigItem::new(STORAGE_HEADER_ID, PluginConfigValue::Boolean(true)),
    ]
}

criterion_group! {
    name = benches;
    config = bench_standrad_config();
    targets = plugin_parser_producer
}

criterion_main!(benches);
