export interface DltParserSettings {
    filter_config: DltFilterConfig | null;
    fibex_file_paths: string[];
    with_storage_header: boolean;
    tz: string;
}
export interface ObserveOptions {
    origin: ObserveOrigin | null;
    parser: ParserType | null;
}
export interface TransportOneof {
    Process?: ProcessTransportConfig;
    Tcp?: TcpTransportConfig;
    Udp?: UdpTransportConfig;
    Serial?: SerialTransportConfig;
}
export interface TcpTransportConfig {
    bind_addr: string;
}
export interface Transport {
    transport_oneof: TransportOneof | null;
}
export interface ProcessTransportConfig {
    cwd: string;
    command: string;
    envs: Map<string, string>;
}
export enum Type {
    PcapNg,
    PcapLegacy,
    Text,
    Binary,
}
export interface SomeIpParserSettings {
    fibex_file_paths: string[];
}
export interface ObserveOrigin {
    origin_oneof: OriginOneof | null;
}
export interface File {
    name: string;
    format: number;
    path: string;
}
export interface MulticastInfo {
    multiaddr: string;
    interface: string;
}
export interface FileFormat {
}
export interface UdpTransportConfig {
    bind_addr: string;
    multicast: MulticastInfo[];
}
export interface DltFilterConfig {
    min_log_level: number;
    app_ids: string[];
    ecu_ids: string[];
    context_ids: string[];
    app_id_count: number;
    context_id_count: number;
}
export interface OriginOneof {
    File?: File;
    Concat?: Concat;
    Stream?: Stream;
}
export interface ParserType {
    type_oneof: TypeOneof | null;
}
export interface TypeOneof {
    Dlt?: DltParserSettings;
    SomeIp?: SomeIpParserSettings;
    Text?: boolean;
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
export interface Concat {
    files: File[];
}
export interface Stream {
    name: string;
    transport: Transport | null;
}
