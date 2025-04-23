use crate::*;

impl Arbitrary for PluginParserSettings {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<PathBuf>(),
            any::<PluginParserGeneralSettings>(),
            prop::collection::vec(any::<PluginConfigItem>(), 0..10),
        )
            .prop_map(
                |(plugin_path, general_settings, plugin_configs)| PluginParserSettings {
                    plugin_path,
                    general_settings,
                    plugin_configs,
                },
            )
            .boxed()
    }
}

impl Arbitrary for PluginParserGeneralSettings {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        any::<String>()
            .prop_map(|placeholder| PluginParserGeneralSettings { placeholder })
            .boxed()
    }
}

impl Arbitrary for PluginByteSourceSettings {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<PathBuf>(),
            any::<PluginByteSourceGeneralSettings>(),
            prop::collection::vec(any::<PluginConfigItem>(), 0..10),
        )
            .prop_map(
                |(plugin_path, general_settings, plugin_configs)| PluginByteSourceSettings {
                    plugin_path,
                    general_settings,
                    plugin_configs,
                },
            )
            .boxed()
    }
}

impl Arbitrary for PluginByteSourceGeneralSettings {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        any::<String>()
            .prop_map(|placeholder| PluginByteSourceGeneralSettings { placeholder })
            .boxed()
    }
}

impl Arbitrary for PluginConfigItem {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<String>(), any::<PluginConfigValue>())
            .prop_map(|(id, value)| PluginConfigItem { id, value })
            .boxed()
    }
}

impl Arbitrary for PluginConfigValue {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        // Reminder to add new items to proptests here.
        match PluginConfigValue::Boolean(true) {
            PluginConfigValue::Boolean(_) => (),
            PluginConfigValue::Integer(_) => (),
            PluginConfigValue::Float(_) => (),
            PluginConfigValue::Text(_) => (),
            PluginConfigValue::Directories(_) => (),
            PluginConfigValue::Files(_) => (),
            PluginConfigValue::Dropdown(_) => (),
        };

        prop_oneof![
            any::<bool>().prop_map(PluginConfigValue::Boolean),
            any::<i32>().prop_map(PluginConfigValue::Integer),
            any::<f32>().prop_map(PluginConfigValue::Float),
            any::<String>().prop_map(PluginConfigValue::Text),
            prop::collection::vec(any::<PathBuf>(), 0..10).prop_map(PluginConfigValue::Directories),
            prop::collection::vec(any::<PathBuf>(), 0..10).prop_map(PluginConfigValue::Files),
            any::<String>().prop_map(PluginConfigValue::Dropdown),
        ]
        .boxed()
    }
}

impl Arbitrary for PluginConfigSchemaType {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        use PluginConfigSchemaType as T;
        // Reminder to add new items to proptests here.
        match T::Boolean(true) {
            T::Boolean(_) => (),
            T::Integer(_) => (),
            T::Float(_) => (),
            T::Text(_) => (),
            T::Directories => (),
            T::Files(_) => (),
            T::Dropdown(_) => (),
        };

        prop_oneof![
            any::<bool>().prop_map(T::Boolean),
            any::<i32>().prop_map(T::Integer),
            any::<f32>().prop_map(T::Float),
            any::<String>().prop_map(T::Text),
            Just(T::Directories),
            prop::collection::vec(any::<String>(), 0..10).prop_map(T::Files),
            (
                prop::collection::vec(any::<String>(), 0..10),
                any::<String>()
            )
                .prop_map(T::Dropdown),
        ]
        .boxed()
    }
}

impl Arbitrary for PluginConfigSchemaItem {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<String>(),
            any::<String>(),
            prop::option::of(any::<String>()),
            any::<PluginConfigSchemaType>(),
        )
            .prop_map(
                |(id, title, description, input_type)| PluginConfigSchemaItem {
                    id,
                    title,
                    description,
                    input_type,
                },
            )
            .boxed()
    }
}

impl Arbitrary for PluginEntity {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<PathBuf>(),
            any::<PluginType>(),
            any::<PluginInfo>(),
            any::<PluginMetadata>(),
            prop::option::of(any::<PathBuf>()),
        )
            .prop_map(
                |(dir_path, plugin_type, info, metadata, readme_path)| Self {
                    dir_path,
                    plugin_type,
                    info,
                    metadata,
                    readme_path,
                },
            )
            .boxed()
    }
}

impl Arbitrary for PluginMetadata {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<String>(), prop::option::of(any::<String>()))
            .prop_map(|(title, description)| Self { title, description })
            .boxed()
    }
}

impl Arbitrary for PluginType {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        // Reminder to add new fields here.
        match Self::ByteSource {
            PluginType::Parser => (),
            PluginType::ByteSource => (),
            PluginType::Producer => (),
        };

        prop_oneof![
            Just(Self::Parser),
            Just(Self::ByteSource),
            Just(Self::Producer)
        ]
        .boxed()
    }
}

impl Arbitrary for PluginInfo {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<PathBuf>(),
            any::<SemanticVersion>(),
            any::<SemanticVersion>(),
            prop::collection::vec(any::<PluginConfigSchemaItem>(), 0..10),
            any::<RenderOptions>(),
        )
            .prop_map(
                |(wasm_file_path, api_version, plugin_version, config_schemas, render_options)| {
                    Self {
                        wasm_file_path,
                        api_version,
                        plugin_version,
                        config_schemas,
                        render_options,
                    }
                },
            )
            .boxed()
    }
}

impl Arbitrary for InvalidPluginEntity {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<PathBuf>(), any::<PluginType>())
            .prop_map(|(dir_path, plugin_type)| Self {
                dir_path,
                plugin_type,
            })
            .boxed()
    }
}

impl Arbitrary for SemanticVersion {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            prop::num::u16::ANY,
            prop::num::u16::ANY,
            prop::num::u16::ANY,
        )
            .prop_map(|(major, minor, patch)| Self {
                major,
                minor,
                patch,
            })
            .boxed()
    }
}

impl Arbitrary for RenderOptions {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        // Reminder to update here on newly added items.
        match Self::ByteSource {
            RenderOptions::Parser(_) => (),
            RenderOptions::ByteSource => (),
            RenderOptions::Producer(_) => (),
        };

        prop_oneof![
            any::<Box<ParserRenderOptions>>().prop_map(Self::Parser),
            Just(Self::ByteSource),
            any::<Box<ProducerRenderOptions>>().prop_map(Self::Producer)
        ]
        .boxed()
    }
}

impl Arbitrary for ParserRenderOptions {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::option::of(any::<ColumnsRenderOptions>())
            .prop_map(|columns_options| Self { columns_options })
            .boxed()
    }
}

impl Arbitrary for ColumnsRenderOptions {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;
    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            prop::collection::vec(any::<ColumnInfo>(), 0..10),
            any::<u16>(),
            any::<u16>(),
        )
            .prop_map(|(columns, min_width, max_width)| Self {
                columns,
                min_width,
                max_width,
            })
            .boxed()
    }
}

impl Arbitrary for ColumnInfo {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;
    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<String>(), any::<String>(), any::<i16>())
            .prop_map(|(caption, description, width)| Self {
                caption,
                description,
                width,
            })
            .boxed()
    }
}

impl Arbitrary for PluginsList {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<PluginEntity>(), 0..7)
            .prop_map(Self)
            .boxed()
    }
}

impl Arbitrary for InvalidPluginsList {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<InvalidPluginEntity>(), 0..7)
            .prop_map(Self)
            .boxed()
    }
}

impl Arbitrary for PluginLogLevel {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            Just(PluginLogLevel::Debug),
            Just(PluginLogLevel::Err),
            Just(PluginLogLevel::Warn),
            Just(PluginLogLevel::Info)
        ]
        .boxed()
    }
}

impl Arbitrary for PluginLogMessage {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<PluginLogLevel>(), any::<String>(), any::<u32>())
            .prop_map(|(level, msg, timestamp)| Self {
                level,
                msg,
                timestamp: timestamp as u64,
            })
            .boxed()
    }
}

impl Arbitrary for PluginRunData {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<PluginLogMessage>(), 0..7)
            .prop_map(|logs| Self { logs })
            .boxed()
    }
}

impl Arbitrary for PluginsPathsList {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<String>(), 0..7)
            .prop_map(Self)
            .boxed()
    }
}

impl Arbitrary for ProducerRenderOptions {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::option::of(any::<ColumnsRenderOptions>())
            .prop_map(|columns_options| Self { columns_options })
            .boxed()
    }
}

impl Arbitrary for PluginProducerSettings {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<PathBuf>(),
            any::<PluginProducerGeneralSettings>(),
            prop::collection::vec(any::<PluginConfigItem>(), 0..10),
        )
            .prop_map(|(plugin_path, general_settings, plugin_configs)| Self {
                plugin_path,
                general_settings,
                plugin_configs,
            })
            .boxed()
    }
}

impl Arbitrary for PluginProducerGeneralSettings {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        any::<String>()
            .prop_map(|placeholder| Self { placeholder })
            .boxed()
    }
}

test_msg!(PluginParserSettings, TESTS_USECASE_COUNT);
test_msg!(PluginParserGeneralSettings, TESTS_USECASE_COUNT);
test_msg!(PluginByteSourceSettings, TESTS_USECASE_COUNT);
test_msg!(PluginByteSourceGeneralSettings, TESTS_USECASE_COUNT);
test_msg!(PluginConfigItem, TESTS_USECASE_COUNT);
test_msg!(PluginConfigValue, TESTS_USECASE_COUNT);
test_msg!(PluginConfigSchemaType, TESTS_USECASE_COUNT);
test_msg!(PluginConfigSchemaItem, TESTS_USECASE_COUNT);
test_msg!(PluginEntity, TESTS_USECASE_COUNT);
test_msg!(PluginMetadata, TESTS_USECASE_COUNT);
test_msg!(PluginType, TESTS_USECASE_COUNT);
test_msg!(PluginInfo, TESTS_USECASE_COUNT);
test_msg!(InvalidPluginEntity, TESTS_USECASE_COUNT);
test_msg!(SemanticVersion, TESTS_USECASE_COUNT);
test_msg!(RenderOptions, TESTS_USECASE_COUNT);
test_msg!(ParserRenderOptions, TESTS_USECASE_COUNT);
test_msg!(ColumnsRenderOptions, TESTS_USECASE_COUNT);
test_msg!(ColumnInfo, TESTS_USECASE_COUNT);
test_msg!(PluginsList, TESTS_USECASE_COUNT);
test_msg!(InvalidPluginsList, TESTS_USECASE_COUNT);
test_msg!(PluginsPathsList, TESTS_USECASE_COUNT);
test_msg!(PluginLogMessage, TESTS_USECASE_COUNT);
test_msg!(ProducerRenderOptions, TESTS_USECASE_COUNT);
test_msg!(PluginProducerSettings, TESTS_USECASE_COUNT);
test_msg!(PluginProducerGeneralSettings, TESTS_USECASE_COUNT);
