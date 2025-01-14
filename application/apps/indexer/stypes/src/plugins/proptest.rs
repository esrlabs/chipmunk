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
        _ = match PluginConfigValue::Boolean(true) {
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
        _ = match T::Boolean {
            T::Boolean => (),
            T::Integer => (),
            T::Float => (),
            T::Text => (),
            T::Directories => (),
            T::Files(_) => (),
            T::Dropdown(_) => (),
        };

        prop_oneof![
            Just(T::Boolean),
            Just(T::Integer),
            Just(T::Float),
            Just(T::Text),
            Just(T::Directories),
            prop::collection::vec(any::<String>(), 0..10).prop_map(T::Files),
            prop::collection::vec(any::<String>(), 0..10).prop_map(T::Dropdown),
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
            any::<PluginState>(),
            prop::option::of(any::<PluginMetadata>()),
        )
            .prop_map(|(dir_path, plugin_type, state, metadata)| Self {
                dir_path,
                plugin_type,
                state,
                metadata,
            })
            .boxed()
    }
}

impl Arbitrary for PluginMetadata {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<String>(), prop::option::of(any::<String>()))
            .prop_map(|(name, description)| Self { name, description })
            .boxed()
    }
}

impl Arbitrary for PluginType {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        // Reminder to add new fields here.
        _ = match Self::ByteSource {
            PluginType::Parser => (),
            PluginType::ByteSource => (),
        };

        prop_oneof![Just(Self::Parser), Just(Self::ByteSource)].boxed()
    }
}

impl Arbitrary for PluginState {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<Box<ValidPluginInfo>>().prop_map(Self::Active),
            any::<Box<InvalidPluginInfo>>().prop_map(Self::Invalid),
        ]
        .boxed()
    }
}

impl Arbitrary for ValidPluginInfo {
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
        _ = match Self::ByteSource {
            RenderOptions::Parser(_) => (),
            RenderOptions::ByteSource => (),
        };

        prop_oneof![
            any::<Box<ParserRenderOptions>>().prop_map(Self::Parser),
            Just(Self::ByteSource),
        ]
        .boxed()
    }
}

impl Arbitrary for ParserRenderOptions {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::option::of(prop::collection::vec(any::<String>(), 0..10))
            .prop_map(|headers| Self { headers })
            .boxed()
    }
}

impl Arbitrary for InvalidPluginInfo {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        any::<String>()
            .prop_map(|error_msg| Self { error_msg })
            .boxed()
    }
}

impl Arbitrary for PluginsList {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<PluginEntity>(), 0..7)
            .prop_map(|plugins| Self(plugins))
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
test_msg!(PluginState, TESTS_USECASE_COUNT);
test_msg!(ValidPluginInfo, TESTS_USECASE_COUNT);
test_msg!(SemanticVersion, TESTS_USECASE_COUNT);
test_msg!(RenderOptions, TESTS_USECASE_COUNT);
test_msg!(ParserRenderOptions, TESTS_USECASE_COUNT);
test_msg!(InvalidPluginInfo, TESTS_USECASE_COUNT);
test_msg!(PluginsList, TESTS_USECASE_COUNT);
