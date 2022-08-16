import { DltParserSettings } from './parsers/dlt';
import { PcapParserSettings } from './parsers/pcap';
import { SomeIPParserSettings } from './parsers/someip';
import { UDPTransportSettings } from './transport/udp';
import { TCPTransportSettings } from './transport/tcp';
import { ProcessTransportSettings } from './transport/process';
import { error } from '../env/logger';
import { SerialTransportSettings } from './transport/serial';
import { filename, basefolder } from '../env/str';

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

export interface Source extends Transport {
    File?: string;
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

export interface SourceDescription {
    major: string;
    minor: string;
    icon: string | undefined;
    type: string;
    state: {
        running: string;
        stopped: string;
    };
}

export class DataSource {
    public File?: [string, Parser];
    public Stream?: [Transport, Parser];

    constructor(opt: ISource) {
        this.File = opt.File;
        this.Stream = opt.Stream;
    }

    public static from(jsonStr: string): Error | DataSource {
        try {
            const parsed = JSON.parse(jsonStr);
            const target = parsed.File === undefined ? parsed.Stream : parsed.File;
            if (target === undefined) {
                throw new Error(`No "File" or "Stream" fields aren't found`);
            }
            if (!(target instanceof Array) || target.length !== 2) {
                throw new Error(`Invalid count of items in "File" or "Stream"`);
            }
            return new DataSource(parsed);
        } catch (err) {
            return new Error(error(err));
        }
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

    public getSource(): Source | Error {
        if (this.File !== undefined) {
            return {
                File: this.File[0],
            };
        }
        if (this.Stream === undefined) {
            return new Error(`Source isn't defined`);
        }
        return this.Stream[0];
    }

    public desc(): SourceDescription | Error {
        if (this.File !== undefined) {
            return {
                major: filename(this.File[0]),
                minor: basefolder(this.File[0]),
                icon: 'insert_drive_file',
                type: 'file',
                state: {
                    running: 'tail',
                    stopped: '',
                },
            };
        }
        if (this.Stream === undefined) {
            return new Error(`Source isn't defined`);
        } else if (this.Stream[0].Process !== undefined) {
            return {
                major: `${this.Stream[0].Process.command} ${this.Stream[0].Process.args.join(' ')}`,
                minor:
                    this.Stream[0].Process.cwd === ''
                        ? 'no defined cwd'
                        : this.Stream[0].Process.cwd,
                icon: 'web_asset',
                type: 'command',
                state: {
                    running: 'spawning',
                    stopped: '',
                },
            };
        } else if (this.Stream[0].UDP !== undefined) {
            return {
                major: this.Stream[0].UDP.bind_addr,
                minor:
                    this.Stream[0].UDP.multicast.length === 0
                        ? ''
                        : this.Stream[0].UDP.multicast.map((m) => m.multiaddr).join(', '),
                icon: 'network_wifi_3_bar',
                type: 'net',
                state: {
                    running: 'listening',
                    stopped: '',
                },
            };
        } else if (this.Stream[0].TCP !== undefined) {
            return {
                major: 'not implemented',
                minor: 'not implemented',
                icon: 'not implemented',
                type: 'not implemented',
                state: {
                    running: 'not implemented',
                    stopped: '',
                },
            };
        } else if (this.Stream[0].Serial !== undefined) {
            return {
                major: this.Stream[0].Serial.path,
                minor: `Baud Rate: ${this.Stream[0].Serial.baud_rate}`,
                icon: 'import_export',
                type: 'serial',
                state: {
                    running: 'listening',
                    stopped: '',
                },
            };
        }
        return new Error(`Unknown source`);
    }

    public toJSON(): string {
        return JSON.stringify({
            File: this.File,
            Stream: this.Stream,
        });
    }
}
