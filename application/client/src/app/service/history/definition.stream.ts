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
        const stream = source.asStream();
        if (stream === undefined) {
            return undefined;
        }
        const def = stream.all();
        let sourceRef: Source;
        let major: string = '';
        let minor: string = '';
        if (def.Serial !== undefined) {
            major = def.Serial.path;
            minor = `${def.Serial.baud_rate}.${def.Serial.data_bits}.${def.Serial.stop_bits}`;
            sourceRef = Source.Serial;
        } else if (def.Process !== undefined) {
            major = `${def.Process.command}`;
            minor = '';
            sourceRef = Source.Process;
        } else if (def.TCP !== undefined) {
            major = def.TCP.bind_addr;
            minor = '';
            sourceRef = Source.Tcp;
        } else if (def.UDP !== undefined) {
            major = def.UDP.bind_addr;
            minor = def.UDP.multicast.map((m) => `${m.multiaddr}-${m.interface}`).join(',');
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
