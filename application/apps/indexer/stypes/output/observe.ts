export enum FileFormat {
    PcapNG,
    PcapLegacy,
    Text,
    Binary,
}
export type Transport =
    { Process: ProcessTransportConfig } |
    { TCP: TCPTransportConfig } |
    { UDP: UDPTransportConfig } |
    { Serial: SerialTransportConfig };
export interface DltParserSettings {
    filter_config: DltFilterConfig | null;
    fibex_file_paths: string[] | null;
    with_storage_header: boolean;
    tz: string | null;
    fibex_metadata: FibexMetadata | null;
}
export interface ObserveOptions {
    origin: ObserveOrigin;
    parser: ParserType;
}
export interface UdpConnectionInfo {
    multicast_addr: MulticastInfo[];
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
export interface MulticastInfo {
    multiaddr: string;
    interface: string | null;
}
export interface ProcessTransportConfig {
    cwd: string;
    command: string;
    envs: Map<string, string>;
}
export interface UDPTransportConfig {
    bind_addr: string;
    multicast: MulticastInfo[];
}
export type ParserType =
    { Dlt: DltParserSettings } |
    { SomeIp: SomeIpParserSettings } |
    { Text: void };
export interface TCPTransportConfig {
    bind_addr: string;
}
export type ObserveOrigin =
    { File: [string,FileFormat,string] } |
    { Concat: [string, FileFormat, string][] } |
    { Stream: [string,Transport] };
