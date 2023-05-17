import {
    DltParserSettings,
    defaultParserSettings as defaultDLTParserSettings,
} from './parsers/dlt';
import { SomeIpParserSettings } from './parsers/someip';
import { UDPTransportSettings } from './transport/udp';
import { TCPTransportSettings } from './transport/tcp';
import { ProcessTransportSettings } from './transport/process';
import { utils } from '../log';
import { SerialTransportSettings } from './transport/serial';
import { filename, basefolder } from '../env/str';
import { SourceDefinition, Source as SourceRef } from './transport/index';
import { unique } from '../env/sequence';

export {
    ProcessTransportSettings,
    UDPTransportSettings,
    TCPTransportSettings,
    SerialTransportSettings,
    defaultDLTParserSettings,
};

export interface ObservedSourceLink {
    id: number;
    alias: string;
}

export enum ParserName {
    Dlt = 'Dlt',
    SomeIp = 'SomeIp',
    Text = 'Text',
}

export enum FileType {
    PcapNG = 'PcapNG',
    Text = 'Text',
    Binary = 'Binary',
}

export enum Origin {
    File = 'File',
    Concat = 'Concat',
    Stream = 'Stream',
}

export interface Parser {
    Dlt?: DltParserSettings;
    SomeIp?: SomeIpParserSettings;
    Text?: null;
    /// Text type is default. No need to define
}

export interface Transport {
    Serial?: SerialTransportSettings;
    Process?: ProcessTransportSettings;
    TCP?: TCPTransportSettings;
    UDP?: UDPTransportSettings;
}

export interface IOrigin {
    File?: [string, FileType, string];
    Concat?: Array<[string, FileType, string]>;
    Stream?: [string, Transport];
}

export interface ISource {
    origin: IOrigin;
    parser: Parser;
}

export interface SourcesFactory {
    dlt(settings: DltParserSettings): DataSource;
    someip(settings: SomeIpParserSettings): DataSource;
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

export interface JobDescription {
    name: string;
    desc: string;
    icon: string | undefined;
}

export class DataSource {
    public readonly origin: IOrigin = {};
    public readonly parser: Parser;
    public readonly childs: DataSource[];
    public readonly parent: DataSource | undefined;
    public readonly uuid: string = unique();

    public static from(jsonStr: string): Error | DataSource {
        try {
            const parsed: ISource = JSON.parse(jsonStr);
            if (parsed.parser === undefined) {
                throw new Error(`Fail to find parser in source definition`);
            }
            if (parsed.origin === undefined) {
                throw new Error(`Fail to find origins in source definition`);
            }
            if (
                parsed.origin.File !== undefined ||
                parsed.origin.Concat instanceof Array ||
                parsed.origin.Stream !== undefined
            ) {
                return new DataSource(parsed);
            }
            throw new Error(`No "File", "Concat" or "Stream" fields aren't found`);
        } catch (err) {
            return new Error(utils.error(err));
        }
    }

    public static file(file: string): {
        text(): SourcesFactory;
        binary(): SourcesFactory;
        pcapng(): SourcesFactory;
    } {
        const factory = (fileType: FileType) => {
            return {
                dlt: (settings: DltParserSettings): DataSource => {
                    return new DataSource({
                        origin: {
                            File: [unique(), fileType, file],
                        },
                        parser: { Dlt: settings },
                    });
                },
                someip: (settings: SomeIpParserSettings): DataSource => {
                    return new DataSource({
                        origin: {
                            File: [unique(), fileType, file],
                        },
                        parser: { SomeIp: settings },
                    });
                },
                text: (): DataSource => {
                    return new DataSource({
                        origin: {
                            File: [unique(), fileType, file],
                        },
                        parser: { Text: null },
                    });
                },
            };
        };
        return {
            text: (): SourcesFactory => {
                return factory(FileType.Text);
            },
            binary: (): SourcesFactory => {
                return factory(FileType.Binary);
            },
            pcapng: (): SourcesFactory => {
                return factory(FileType.PcapNG);
            },
        };
    }

    public static concat(files: [FileType, string][]): SourcesFactory {
        return {
            dlt: (settings: DltParserSettings): DataSource => {
                return new DataSource({
                    origin: {
                        Concat: files.map((f: [FileType, string]) => {
                            return [unique(), f[0], f[1]];
                        }),
                    },
                    parser: { Dlt: settings },
                });
            },
            someip: (settings: SomeIpParserSettings): DataSource => {
                return new DataSource({
                    origin: {
                        Concat: files.map((f: [FileType, string]) => {
                            return [unique(), f[0], f[1]];
                        }),
                    },
                    parser: { SomeIp: settings },
                });
            },
            text: (): DataSource => {
                return new DataSource({
                    origin: {
                        Concat: files.map((f: [FileType, string]) => {
                            return [unique(), f[0], f[1]];
                        }),
                    },
                    parser: { Text: null },
                });
            },
        };
    }

    public static stream(): {
        serial(Serial: SerialTransportSettings): SourcesFactory;
        process(Process: ProcessTransportSettings): SourcesFactory;
        udp(UDP: UDPTransportSettings): SourcesFactory;
        tcp(TCP: TCPTransportSettings): SourcesFactory;
    } {
        return {
            serial: (Serial: SerialTransportSettings): SourcesFactory => {
                const origin: IOrigin = { Stream: [unique(), { Serial }] };
                return {
                    dlt: (settings: DltParserSettings): DataSource => {
                        return new DataSource({
                            origin,
                            parser: { Dlt: settings },
                        });
                    },
                    someip: (settings: SomeIpParserSettings): DataSource => {
                        return new DataSource({
                            origin,
                            parser: { SomeIp: settings },
                        });
                    },
                    text: (): DataSource => {
                        return new DataSource({
                            origin,
                            parser: { Text: null },
                        });
                    },
                };
            },
            process: (Process: ProcessTransportSettings): SourcesFactory => {
                const origin: IOrigin = {
                    Stream: [unique(), { Process }],
                };
                return {
                    dlt: (settings: DltParserSettings): DataSource => {
                        return new DataSource({
                            origin,
                            parser: { Dlt: settings },
                        });
                    },
                    someip: (settings: SomeIpParserSettings): DataSource => {
                        return new DataSource({
                            origin,
                            parser: { SomeIp: settings },
                        });
                    },
                    text: (): DataSource => {
                        return new DataSource({
                            origin,
                            parser: { Text: null },
                        });
                    },
                };
            },
            udp: (UDP: UDPTransportSettings): SourcesFactory => {
                const origin: IOrigin = { Stream: [unique(), { UDP }] };
                return {
                    dlt: (settings: DltParserSettings): DataSource => {
                        return new DataSource({
                            origin,
                            parser: { Dlt: settings },
                        });
                    },
                    someip: (settings: SomeIpParserSettings): DataSource => {
                        return new DataSource({
                            origin,
                            parser: { SomeIp: settings },
                        });
                    },
                    text: (): DataSource => {
                        return new DataSource({
                            origin,
                            parser: { Text: null },
                        });
                    },
                };
            },
            tcp: (TCP: TCPTransportSettings): SourcesFactory => {
                const origin: IOrigin = { Stream: [unique(), { TCP }] };
                return {
                    dlt: (settings: DltParserSettings): DataSource => {
                        return new DataSource({
                            origin,
                            parser: { Dlt: settings },
                        });
                    },
                    someip: (settings: SomeIpParserSettings): DataSource => {
                        return new DataSource({
                            origin,
                            parser: { SomeIp: settings },
                        });
                    },
                    text: (): DataSource => {
                        return new DataSource({
                            origin,
                            parser: { Text: null },
                        });
                    },
                };
            },
        };
    }

    constructor(opt: ISource, parent?: DataSource) {
        this.origin = opt.origin;
        this.parser = opt.parser;
        this.parent = parent;
        this.childs = this.getChilds();
    }

    public is(): {
        file: boolean;
        concat: boolean;
        tcp: boolean;
        udp: boolean;
        process: boolean;
        serial: boolean;
    } {
        const file = this.asFile();
        const concat = this.asConcatedFiles();
        const stream = this.asStream();
        const streams = stream !== undefined ? stream.all() : undefined;
        return {
            file: file !== undefined,
            concat: concat !== undefined,
            tcp: streams === undefined ? false : streams.TCP !== undefined,
            udp: streams === undefined ? false : streams.UDP !== undefined,
            process: streams === undefined ? false : streams.Process !== undefined,
            serial: streams === undefined ? false : streams.Serial !== undefined,
        };
    }

    public isSDEAvaliable(): boolean {
        const nature = this.is();
        if (nature.file || nature.concat || nature.tcp || nature.udp) {
            return false;
        }
        return true;
    }

    public asFile(): string | undefined {
        if (this.origin.File === undefined) {
            return undefined;
        }
        return this.origin.File[2];
    }

    public asConcatedFiles(): string[] | undefined {
        if (this.origin.Concat === undefined) {
            return undefined;
        }
        return this.origin.Concat.map((f) => f[2]);
    }

    public asStream():
        | {
              serial(): SerialTransportSettings | undefined;
              udp(): UDPTransportSettings | undefined;
              tcp(): TCPTransportSettings | undefined;
              process(): ProcessTransportSettings | undefined;
              all(): Transport;
          }
        | undefined {
        const stream = this.origin.Stream;
        if (stream === undefined) {
            return undefined;
        }
        return {
            serial: (): SerialTransportSettings | undefined => {
                return stream[1].Serial;
            },
            udp: (): UDPTransportSettings | undefined => {
                return stream[1].UDP;
            },
            tcp: (): TCPTransportSettings | undefined => {
                return stream[1].TCP;
            },
            process: (): ProcessTransportSettings | undefined => {
                return stream[1].Process;
            },
            all: (): Transport => {
                return stream[1];
            },
        };
    }

    public getParserName(): ParserName | Error {
        const parser: Parser | Error = (() => {
            if (this.parser !== undefined) {
                return this.parser;
            } else {
                return new Error(`Not File, not Stream aren't defined in DataSource`);
            }
        })();
        if (parser instanceof Error) {
            return parser;
        }
        if (parser.Dlt !== undefined) {
            return ParserName.Dlt;
        } else if (parser.SomeIp !== undefined) {
            return ParserName.SomeIp;
        } else if (parser.Text !== undefined) {
            return ParserName.Text;
        } else {
            return new Error(`Unknown parser`);
        }
    }

    public getOrigin(): Origin | Error {
        if (this.is().concat) {
            return Origin.Concat;
        } else if (this.is().file) {
            return Origin.File;
        } else if (this.asStream() !== undefined) {
            return Origin.Stream;
        } else {
            return new Error(`Cannot detect Origin of DataSource`);
        }
    }

    public asSourceDefinition(): SourceDefinition | Error {
        const stream = this.asStream();
        if (stream === undefined) {
            return new Error(
                `DataSource bound with File. SourceDefinition is available only for streams`,
            );
        }
        return {
            serial: stream.serial(),
            process: stream.process(),
            tcp: stream.tcp(),
            udp: stream.udp(),
        };
    }

    public asSourceRef(): SourceRef | Error {
        const stream = this.asStream();
        if (stream === undefined) {
            return new Error(
                `DataSource bound with File. SourceDefinition is available only for streams`,
            );
        }
        if (stream.serial() !== undefined) {
            return SourceRef.Serial;
        } else if (stream.process() !== undefined) {
            return SourceRef.Process;
        } else if (stream.tcp() !== undefined) {
            return SourceRef.Tcp;
        } else if (stream.udp() !== undefined) {
            return SourceRef.Udp;
        } else {
            return new Error(`Unknown source`);
        }
    }

    protected getChilds(): DataSource[] {
        if (this.origin.Concat !== undefined) {
            return this.origin.Concat.map((file) => {
                return new DataSource(
                    {
                        origin: { File: file },
                        parser: this.parser,
                    },
                    this,
                );
            });
        }
        return [];
    }

    public desc(): SourceDescription | Error {
        const file = this.asFile();
        const concat = this.asConcatedFiles();
        const stream = this.asStream();
        if (file !== undefined) {
            return {
                major: filename(file),
                minor: basefolder(file),
                icon: 'insert_drive_file',
                type: 'file',
                state: {
                    running: 'tail',
                    stopped: '',
                },
            };
        }
        if (concat !== undefined) {
            return {
                major: `Concating ${concat.length} files`,
                minor: basefolder(concat[0]),
                icon: 'insert_drive_file',
                type: 'file',
                state: {
                    running: 'processing',
                    stopped: '',
                },
            };
        }
        if (stream === undefined) {
            return new Error(`Source isn't defined`);
        }
        const streaming = stream.all();
        if (streaming.Process !== undefined) {
            return {
                major: `${streaming.Process.command}`,
                minor: streaming.Process.cwd === '' ? 'no defined cwd' : streaming.Process.cwd,
                icon: 'web_asset',
                type: 'command',
                state: {
                    running: 'spawning',
                    stopped: '',
                },
            };
        } else if (streaming.UDP !== undefined) {
            return {
                major: streaming.UDP.bind_addr,
                minor:
                    streaming.UDP.multicast.length === 0
                        ? ''
                        : streaming.UDP.multicast.map((m) => m.multiaddr).join(', '),
                icon: 'network_wifi_3_bar',
                type: 'net',
                state: {
                    running: 'listening',
                    stopped: '',
                },
            };
        } else if (streaming.TCP !== undefined) {
            return {
                major: streaming.TCP.bind_addr,
                minor: '',
                icon: 'network_wifi_3_bar',
                type: 'net',
                state: {
                    running: 'listening',
                    stopped: '',
                },
            };
        } else if (streaming.Serial !== undefined) {
            return {
                major: streaming.Serial.path,
                minor: `Baud Rate: ${streaming.Serial.baud_rate}`,
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

    public asJob(): JobDescription | Error {
        const file = this.asFile();
        const concat = this.asConcatedFiles();
        const stream = this.asStream();
        if (file !== undefined) {
            return {
                name: 'tail',
                desc: filename(file),
                icon: 'insert_drive_file',
            };
        }
        if (concat !== undefined) {
            return {
                name: 'concating',
                desc: `concating ${concat.length} files`,
                icon: 'insert_drive_file',
            };
        }
        if (stream === undefined) {
            return new Error(`Source isn't defined`);
        }
        const streaming = stream.all();
        if (streaming.Process !== undefined) {
            return {
                name: `${streaming.Process.command}`,
                desc: `${streaming.Process.command}`,
                icon: 'web_asset',
            };
        } else if (streaming.UDP !== undefined) {
            return {
                name: `UDP: ${streaming.UDP.bind_addr}`,
                desc:
                    streaming.UDP.multicast.length === 0
                        ? `Connecting to ${streaming.UDP.bind_addr} via UDP (no multicasts)`
                        : streaming.UDP.multicast.map((m) => m.multiaddr).join(', '),
                icon: 'network_wifi_3_bar',
            };
        } else if (streaming.TCP !== undefined) {
            return {
                name: `TCP: ${streaming.TCP.bind_addr}`,
                desc: `Connecting to ${streaming.TCP.bind_addr} via TCP`,
                icon: 'network_wifi_3_bar',
            };
        } else if (streaming.Serial !== undefined) {
            return {
                name: `Serial: ${streaming.Serial.path}`,
                desc: `Baud Rate: ${streaming.Serial.baud_rate}`,
                icon: 'import_export',
            };
        }
        return new Error(`Unknown source`);
    }

    public alias(): string {
        if (this.origin.File !== undefined) {
            return this.origin.File[0];
        }
        if (this.origin.Stream !== undefined) {
            return this.origin.Stream[0];
        }
        return '';
    }

    public toJSON(): string {
        return JSON.stringify({
            origin: this.origin,
            parser: this.parser,
        });
    }
}
