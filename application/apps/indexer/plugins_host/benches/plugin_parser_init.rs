use criterion::{criterion_group, criterion_main, Criterion};
use sources::plugins::PluginParserSettings;
use std::{hint::black_box, path::PathBuf};

// Use the same environment variable for input source from other benchmarks
pub const PLUGIN_PATH_ENV_VAR: &str = "CHIPMUNK_BENCH_SOURCE";

/// This benchmark covers loading, compiling and validating a parser plugin
fn plugin_parser_init(c: &mut Criterion) {
    let plugin_file = match std::env::var(PLUGIN_PATH_ENV_VAR) {
        Ok(input) =>PathBuf::from(input),
        Err(err) => panic!("Error while retrieving plugin file.\n\
            Please ensure to provide the path of plugin file for benchmarks via command line arguments \
            if you are using chipmunk build cli tool\n\
            or via the environment variable: '{PLUGIN_PATH_ENV_VAR}' if you are running the benchmark directly.\n\
            Error Info: {err}"),
    };

    assert!(
        plugin_file.exists(),
        "Provided plugin file path doesn't exist. Path: {}",
        plugin_file.display()
    );

    //TODO AAZ: Deliver plugin configurations for benchmarks
    let plugin_configs = Vec::new();

    let settings = black_box(PluginParserSettings::prototyping(
        plugin_file,
        plugin_configs,
    ));

    c.bench_function("plugin_parser_init", |bencher| {
        bencher
            .to_async(tokio::runtime::Runtime::new().unwrap())
            .iter(|| async {
                // Creating parser will load compile and validate the provided plugin
                let parser = plugins_host::PluginsParser::create(
                    &settings.plugin_path,
                    &settings.general_settings,
                    settings.plugin_configs.clone(),
                )
                .await
                .unwrap();

                // Avoid compiler optimization
                black_box(&parser);
            })
    });
}

criterion_group! {
    name = benches;
    config = Criterion::default();
    targets = plugin_parser_init
}

criterion_main!(benches);
