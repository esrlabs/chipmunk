import { DltParserSettings } from './interface.rust.api.dlt';
import { PcapParserSettings } from './interface.rust.api.pcap';
import { SomeIPParserSettings } from './interface.rust.api.someip';
/*
#[derive(Debug, Clone, Serialize)]
pub enum ParserType {
    Dlt(DltParserSettings),
    Pcap(PcapParserSettings),
    SomeIP(SomeIPParserSettings),
    Text,
}
*/

export interface Parser {
    Dlt?: DltParserSettings;
    Pcap?: PcapParserSettings;
    Someip?: SomeIPParserSettings;
    Text?: null;
    /// Text type is default. No need to define
}

export interface Transport {}

export interface ISource {
    File?: [string, Parser];
    Stream?: [Transport, Parser];
}

export class DataSource {
    public File?: [string, Parser];
    public Stream?: [Transport, Parser];

    constructor(opt: ISource) {
        this.File = opt.File;
        this.Stream = opt.Stream;
    }

    public static asTextFile(filename: string): DataSource {
        return new DataSource({ File: [filename, { Text: null }] });
    }

    public static asPcapFile(filename: string, settings: PcapParserSettings): DataSource {
        return new DataSource({ File: [filename, { Pcap: settings }] });
    }

    public static asDltFile(filename: string, settings: DltParserSettings): DataSource {
        return new DataSource({ File: [filename, { Dlt: settings }] });
    }

    public toJSON(): string {
        return JSON.stringify({
            File: this.File,
            Stream: this.Stream,
        });
    }
}
