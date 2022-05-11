export interface MulticastInfo {
    multiaddr: string;
    interface: string | undefined;
}
export interface UDPTransportSettings {
    bind_addr: string;
    multicast: MulticastInfo[];
    dest_path: string;
}
