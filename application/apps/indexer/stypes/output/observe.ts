export interface MulticastInfo {
    multiaddr: string;
    interface: string | null;
}
export interface DltParserSettings {
    filter_config: DltFilterConfig | null;
    fibex_file_paths: string[] | null;
    with_storage_header: boolean;
    tz: string | null;
    fibex_metadata: FibexMetadata | null;
}
export interface TCPTransportConfig {
    bind_addr: string;
}
export interface ObserveOrigin {
    File?: [string, FileFormat, string];
    Concat?: [string, FileFormat, string][];
    Stream?: [string, Transport];
}
export enum FileFormat {
    PcapNG,
    PcapLegacy,
    Text,
    Binary,
}
export interface ObserveOptions {
    origin: ObserveOrigin;
    parser: ParserType;
}
export interface SomeIpParserSettings {
    fibex_file_paths: string[] | null;
}
export interface SerialTransportConfig {
    path: string;
    baud_rate: number;
    data_bits: number;
    flow_control: number;
    parity: number;
    stop_bits: number;
    send_data_delay: number;
    exclusive: boolean;
}
export interface ProcessTransportConfig {
    cwd: string;
    command: string;
    envs: Map<string, string>;
}
export interface ParserType {
    Dlt?: DltParserSettings;
    SomeIp?: SomeIpParserSettings;
    Text?: void;
}
export interface Transport {
    Process?: ProcessTransportConfig;
    TCP?: TCPTransportConfig;
    UDP?: UDPTransportConfig;
    Serial?: SerialTransportConfig;
}
export interface UDPTransportConfig {
    bind_addr: string;
    multicast: MulticastInfo[];
}
export interface UdpConnectionInfo {
    multicast_addr: MulticastInfo[];
}
