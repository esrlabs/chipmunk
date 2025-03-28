use criterion::{criterion_group, criterion_main, Criterion};
use std::hint::black_box;

mod plugin_utls;

/// This benchmark covers loading, compiling and validating a parser plugin
fn plugin_parser_init(c: &mut Criterion) {
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

    c.bench_function("plugin_parser_init", |bencher| {
        bencher
            .to_async(tokio::runtime::Runtime::new().unwrap())
            .iter(|| async {
                // Creating parser will load compile and validate the provided plugin
                let parser = plugins_host::PluginsParser::initialize(
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
