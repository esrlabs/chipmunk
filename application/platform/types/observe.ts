import { DltParserSettings } from './parsers/dlt';
import { PcapParserSettings } from './parsers/pcap';
import { SomeIPParserSettings } from './parsers/someip';
import { UDPTransportSettings } from './transport/udp';
import { TCPTransportSettings } from './transport/tcp';
import { ProcessTransportSettings } from './transport/process';
import { SerialTransportSettings } from './transport/serial';

export interface Parser {
    Dlt?: DltParserSettings;
    Pcap?: PcapParserSettings;
    Someip?: SomeIPParserSettings;
    Text?: null;
    /// Text type is default. No need to define
}

export interface Transport {
    Serial?: SerialTransportSettings;
    Process?: ProcessTransportSettings;
    TCP?: TCPTransportSettings;
    UDP?: UDPTransportSettings;
}

export interface ISource {
    File?: [string, Parser];
    Stream?: [Transport, Parser];
}

export interface SourcesFactory {
    dlt(settings: DltParserSettings): DataSource;
    pcap(settings: PcapParserSettings): DataSource;
    text(): DataSource;
}

export class DataSource {
    public File?: [string, Parser];
    public Stream?: [Transport, Parser];

    constructor(opt: ISource) {
        this.File = opt.File;
        this.Stream = opt.Stream;
    }

    public static file(filename: string): SourcesFactory {
        return {
            dlt: (settings: DltParserSettings): DataSource => {
                return new DataSource({ File: [filename, { Dlt: settings }] });
            },
            pcap: (settings: PcapParserSettings): DataSource => {
                return new DataSource({ File: [filename, { Pcap: settings }] });
            },
            text: (): DataSource => {
                return new DataSource({ File: [filename, { Text: null }] });
            },
        };
    }

    public static stream(): {
        serial(Serial: SerialTransportSettings): SourcesFactory;
        process(Process: ProcessTransportSettings): SourcesFactory;
        upd(UDP: UDPTransportSettings): SourcesFactory;
        tcp(TCP: TCPTransportSettings): SourcesFactory;
    } {
        return {
            serial: (Serial: SerialTransportSettings): SourcesFactory => {
                return {
                    dlt: (settings: DltParserSettings): DataSource => {
                        return new DataSource({ Stream: [{ Serial }, { Dlt: settings }] });
                    },
                    pcap: (settings: PcapParserSettings): DataSource => {
                        return new DataSource({ Stream: [{ Serial }, { Pcap: settings }] });
                    },
                    text: (): DataSource => {
                        return new DataSource({ Stream: [{ Serial }, { Text: null }] });
                    },
                };
            },
            process: (Process: ProcessTransportSettings): SourcesFactory => {
                return {
                    dlt: (settings: DltParserSettings): DataSource => {
                        return new DataSource({ Stream: [{ Process }, { Dlt: settings }] });
                    },
                    pcap: (settings: PcapParserSettings): DataSource => {
                        return new DataSource({ Stream: [{ Process }, { Pcap: settings }] });
                    },
                    text: (): DataSource => {
                        return new DataSource({ Stream: [{ Process }, { Text: null }] });
                    },
                };
            },
            upd: (UDP: UDPTransportSettings): SourcesFactory => {
                return {
                    dlt: (settings: DltParserSettings): DataSource => {
                        return new DataSource({ Stream: [{ UDP }, { Dlt: settings }] });
                    },
                    pcap: (settings: PcapParserSettings): DataSource => {
                        return new DataSource({ Stream: [{ UDP }, { Pcap: settings }] });
                    },
                    text: (): DataSource => {
                        return new DataSource({ Stream: [{ UDP }, { Text: null }] });
                    },
                };
            },
            tcp: (TCP: TCPTransportSettings): SourcesFactory => {
                return {
                    dlt: (settings: DltParserSettings): DataSource => {
                        return new DataSource({ Stream: [{ TCP }, { Dlt: settings }] });
                    },
                    pcap: (settings: PcapParserSettings): DataSource => {
                        return new DataSource({ Stream: [{ TCP }, { Pcap: settings }] });
                    },
                    text: (): DataSource => {
                        return new DataSource({ Stream: [{ TCP }, { Text: null }] });
                    },
                };
            },
        };
    }

    public toJSON(): string {
        return JSON.stringify({
            File: this.File,
            Stream: this.Stream,
        });
    }
}
