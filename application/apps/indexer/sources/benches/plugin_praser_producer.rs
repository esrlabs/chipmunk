use criterion::{criterion_group, criterion_main, BatchSize, Criterion};
use plugins_host::PluginsParser;
use std::{hint::black_box, path::PathBuf};

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

    //TODO AAZ: Deliver plugin configurations for benchmarks
    let plugin_configs = Vec::new();

    let settings = stypes::PluginParserSettings::prototyping(plugin_path, plugin_configs);

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

criterion_group! {
    name = benches;
    config = bench_standrad_config();
    targets = plugin_parser_producer
}

criterion_main!(benches);
