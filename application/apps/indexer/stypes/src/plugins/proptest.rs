use crate::*;

impl Arbitrary for PluginParserSettings {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<PathBuf>(),
            any::<PluginParserGeneralSettings>(),
            any::<Vec<PluginConfigItem>>(),
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
            any::<Vec<PluginConfigItem>>(),
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
            PluginConfigValue::Number(_) => (),
            PluginConfigValue::Float(_) => (),
            PluginConfigValue::Text(_) => (),
            PluginConfigValue::Path(_) => (),
            PluginConfigValue::Dropdown(_) => (),
        };

        prop_oneof![
            any::<bool>().prop_map(PluginConfigValue::Boolean),
            any::<i64>().prop_map(PluginConfigValue::Number),
            any::<f64>().prop_map(PluginConfigValue::Float),
            any::<String>().prop_map(PluginConfigValue::Text),
            any::<PathBuf>().prop_map(PluginConfigValue::Path),
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
            T::Number => (),
            T::Float => (),
            T::Text => (),
            T::Path => (),
            T::Dropdown(_) => (),
        };

        prop_oneof![
            Just(T::Boolean),
            Just(T::Number),
            Just(T::Float),
            Just(T::Text),
            Just(T::Path),
            any::<Vec<String>>().prop_map(T::Dropdown),
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
            any::<Option<String>>(),
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

test_msg!(PluginParserSettings, TESTS_USECASE_COUNT);
test_msg!(PluginParserGeneralSettings, TESTS_USECASE_COUNT);
test_msg!(PluginByteSourceSettings, TESTS_USECASE_COUNT);
test_msg!(PluginByteSourceGeneralSettings, TESTS_USECASE_COUNT);
test_msg!(PluginConfigItem, TESTS_USECASE_COUNT);
test_msg!(PluginConfigValue, TESTS_USECASE_COUNT);
test_msg!(PluginConfigSchemaType, TESTS_USECASE_COUNT);
test_msg!(PluginConfigSchemaItem, TESTS_USECASE_COUNT);
