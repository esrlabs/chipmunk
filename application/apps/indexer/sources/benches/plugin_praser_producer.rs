use criterion::{criterion_group, criterion_main, BatchSize, Criterion};
use plugins_host::PluginsParser;
use std::hint::black_box;

use bench_utls::{bench_standrad_config, create_binary_bytesource, read_binary, run_producer};
use sources::producer::CombinedProducer;

mod bench_utls;

// Note:
// Rust LSP may mark this as an error, but this is an issue with the LSP itself.
// The code will compile without problems.

#[path = "./../../plugins_host/benches/plugin_utls.rs"]
mod plugin_utls;

/// This benchmark covers parsing the given file using a plugin parser.
/// The path for the plugin's configurations file is provided via the additional
/// configuration environment variable.
fn plugin_parser_producer(c: &mut Criterion) {
    let data = read_binary();

    let plug_config = plugin_utls::get_plugin_config();

    assert!(
        plug_config.binary_path.exists(),
        "Provided plugin file path doesn't exist. Path: {}",
        plug_config.binary_path.display()
    );

    let settings = black_box(stypes::PluginParserSettings::new(
        plug_config.binary_path,
        stypes::PluginParserGeneralSettings::default(),
        plug_config.config,
    ));

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
                    let producer = CombinedProducer::new(parser, source);

                    producer
                },
                |p| run_producer(p),
                BatchSize::SmallInput,
            )
    });
}

criterion_group! {
    name = benches;
    config = bench_standrad_config();
    targets = plugin_parser_producer
}

criterion_main!(benches);
