use crate::*;
use dlt_core::filtering::DltFilterConfig;

impl Arbitrary for MulticastInfo {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<String>(), any::<Option<String>>())
            .prop_map(|(multiaddr, interface)| MulticastInfo {
                multiaddr,
                interface,
            })
            .boxed()
    }
}

impl Arbitrary for UdpConnectionInfo {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop::collection::vec(any::<MulticastInfo>(), 0..10)
            .prop_map(|multicast_addr| UdpConnectionInfo { multicast_addr })
            .boxed()
    }
}

impl Arbitrary for ParserType {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<DltParserSettings>().prop_map(ParserType::Dlt),
            any::<SomeIpParserSettings>().prop_map(ParserType::SomeIp),
            Just(ParserType::Text(())),
            any::<PluginParserSettings>().prop_map(ParserType::Plugin)
        ]
        .boxed()
    }
}

#[derive(Debug)]
struct DltFilterConfigWrapper(pub DltFilterConfig);

impl Arbitrary for DltFilterConfigWrapper {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<Option<u8>>(),
            any::<Option<Vec<String>>>(),
            any::<Option<Vec<String>>>(),
            any::<Option<Vec<String>>>(),
            any::<i32>(),
            any::<i32>(),
        )
            .prop_map(
                |(min_log_level, app_ids, ecu_ids, context_ids, app_id_count, context_id_count)| {
                    DltFilterConfigWrapper(DltFilterConfig {
                        min_log_level,
                        app_ids,
                        ecu_ids,
                        context_ids,
                        app_id_count: app_id_count as i64,
                        context_id_count: context_id_count as i64,
                    })
                },
            )
            .boxed()
    }
}

impl Arbitrary for DltParserSettings {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<Option<DltFilterConfigWrapper>>().prop_map(|wrp| wrp.map(|wrp| wrp.0)),
            any::<Option<Vec<String>>>(),
            any::<bool>(),
            any::<Option<String>>(),
            Just(None), // fibex_metadata is skipped
        )
            .prop_map(
                |(filter_config, fibex_file_paths, with_storage_header, tz, fibex_metadata)| {
                    DltParserSettings {
                        filter_config,
                        fibex_file_paths,
                        with_storage_header,
                        tz,
                        fibex_metadata,
                    }
                },
            )
            .boxed()
    }
}

impl Arbitrary for SomeIpParserSettings {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        any::<Option<Vec<String>>>()
            .prop_map(|fibex_file_paths| SomeIpParserSettings { fibex_file_paths })
            .boxed()
    }
}

impl Arbitrary for Transport {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            any::<ProcessTransportConfig>().prop_map(Transport::Process),
            any::<TCPTransportConfig>().prop_map(Transport::TCP),
            any::<UDPTransportConfig>().prop_map(Transport::UDP),
            any::<SerialTransportConfig>().prop_map(Transport::Serial),
        ]
        .boxed()
    }
}

impl Arbitrary for ProcessTransportConfig {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<PathBuf>(),
            any::<String>(),
            any::<Option<ShellProfile>>(),
        )
            .prop_map(|(cwd, command, shell)| ProcessTransportConfig {
                cwd,
                command,
                shell,
            })
            .boxed()
    }
}

impl Arbitrary for SerialTransportConfig {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<String>(),
            any::<u32>(),
            any::<u8>(),
            any::<u8>(),
            any::<u8>(),
            any::<u8>(),
            any::<u8>(),
            any::<bool>(),
        )
            .prop_map(
                |(
                    path,
                    baud_rate,
                    data_bits,
                    flow_control,
                    parity,
                    stop_bits,
                    send_data_delay,
                    exclusive,
                )| {
                    SerialTransportConfig {
                        path,
                        baud_rate,
                        data_bits,
                        flow_control,
                        parity,
                        stop_bits,
                        send_data_delay,
                        exclusive,
                    }
                },
            )
            .boxed()
    }
}

impl Arbitrary for TCPTransportConfig {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        any::<String>()
            .prop_map(|bind_addr| TCPTransportConfig { bind_addr })
            .boxed()
    }
}

impl Arbitrary for UDPTransportConfig {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            any::<String>(),
            prop::collection::vec(any::<MulticastInfo>(), 0..10),
        )
            .prop_map(|(bind_addr, multicast)| UDPTransportConfig {
                bind_addr,
                multicast,
            })
            .boxed()
    }
}

impl Arbitrary for FileFormat {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        // Reminder to extend tests here when new items are added.
        match FileFormat::Text {
            FileFormat::PcapNG => {}
            FileFormat::PcapLegacy => {}
            FileFormat::Text => {}
            FileFormat::Binary => {}
        };

        prop_oneof![
            Just(FileFormat::PcapNG),
            Just(FileFormat::PcapLegacy),
            Just(FileFormat::Text),
            Just(FileFormat::Binary),
        ]
        .boxed()
    }
}

impl Arbitrary for ObserveOrigin {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        prop_oneof![
            (any::<String>(), any::<FileFormat>(), any::<PathBuf>(),)
                .prop_map(|(filename, format, path)| ObserveOrigin::File(filename, format, path)),
            prop::collection::vec(
                (any::<String>(), any::<FileFormat>(), any::<PathBuf>(),),
                0..10,
            )
            .prop_map(ObserveOrigin::Concat),
            (any::<String>(), any::<Transport>(),)
                .prop_map(|(stream, transport)| ObserveOrigin::Stream(stream, transport)),
        ]
        .boxed()
    }
}

impl Arbitrary for ObserveOptions {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (any::<ObserveOrigin>(), any::<ParserType>())
            .prop_map(|(origin, parser)| ObserveOptions { origin, parser })
            .boxed()
    }
}

test_msg!(ObserveOptions, TESTS_USECASE_COUNT);
test_msg!(ObserveOrigin, TESTS_USECASE_COUNT);
test_msg!(FileFormat, TESTS_USECASE_COUNT);
test_msg!(UDPTransportConfig, TESTS_USECASE_COUNT);
test_msg!(TCPTransportConfig, TESTS_USECASE_COUNT);
test_msg!(SerialTransportConfig, TESTS_USECASE_COUNT);
test_msg!(ProcessTransportConfig, TESTS_USECASE_COUNT);
test_msg!(Transport, TESTS_USECASE_COUNT);
test_msg!(SomeIpParserSettings, TESTS_USECASE_COUNT);
test_msg!(DltParserSettings, TESTS_USECASE_COUNT);
test_msg!(ParserType, TESTS_USECASE_COUNT);
test_msg!(UdpConnectionInfo, TESTS_USECASE_COUNT);
test_msg!(MulticastInfo, TESTS_USECASE_COUNT);
