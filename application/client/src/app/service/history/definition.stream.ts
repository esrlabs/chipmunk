import { Source } from '@platform/types/transport/index';
import { DataSource } from '@platform/types/observe';

import * as obj from '@platform/env/obj';

export interface IStreamDesc {
    source: Source;
    major: string;
    minor: string;
}

export class StreamDesc implements IStreamDesc {
    static async fromDataSource(source: DataSource): Promise<IStreamDesc | undefined> {
        if (source.Stream === undefined) {
            return undefined;
        }
        let sourceRef: Source;
        let major: string = '';
        let minor: string = '';
        if (source.Stream[0].Serial !== undefined) {
            major = source.Stream[0].Serial.path;
            minor = `${source.Stream[0].Serial.baud_rate}.${source.Stream[0].Serial.data_bits}.${source.Stream[0].Serial.stop_bits}`;
            sourceRef = Source.Serial;
        } else if (source.Stream[0].Process !== undefined) {
            major = `${source.Stream[0].Process.command} ${source.Stream[0].Process.args.join(
                ',',
            )}`;
            minor = '';
            sourceRef = Source.Process;
        } else if (source.Stream[0].TCP !== undefined) {
            major = source.Stream[0].TCP.bind_addr;
            minor = '';
            sourceRef = Source.Tcp;
        } else if (source.Stream[0].UDP !== undefined) {
            major = source.Stream[0].UDP.bind_addr;
            minor = source.Stream[0].UDP.multicast
                .map((m) => `${m.multiaddr}-${m.interface}`)
                .join(',');
            sourceRef = Source.Udp;
        } else {
            throw new Error(`Unknown source`);
        }
        return {
            source: sourceRef,
            major,
            minor,
        };
    }

    static fromMinifiedStr(
        src: { [key: string]: number | string } | undefined,
    ): StreamDesc | undefined {
        return src === undefined
            ? undefined
            : new StreamDesc({
                  source: obj.getAsNotEmptyString(src, 's') as Source,
                  major: obj.getAsString(src, 'ma'),
                  minor: obj.getAsString(src, 'mi'),
              });
    }

    public source: Source;
    public major: string;
    public minor: string;

    constructor(definition: IStreamDesc) {
        this.source = definition.source;
        this.major = definition.major;
        this.minor = definition.minor;
    }

    public isSame(stream: StreamDesc): boolean {
        return stream.source === this.source && this.major === stream.major;
    }

    public minify(): { [key: string]: number | string } {
        return {
            s: this.source,
            mi: this.minor,
            ma: this.major,
        };
    }
}
