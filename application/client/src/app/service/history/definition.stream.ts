import { ObserveOperation } from '@service/session/dependencies/stream';
import { SessionDescriptor } from '@platform/types/bindings';

import * as obj from '@platform/env/obj';

export interface IStreamDesc {
    source: string;
    major: string;
    minor: string;
}

export class StreamDesc implements IStreamDesc {
    static fromDataSource(operation: ObserveOperation): Promise<IStreamDesc | undefined> {
        if (operation.getOrigin().isStream()) {
            return Promise.resolve(undefined);
        }
        const descriptor = operation.getDescriptor();
        if (!descriptor) {
            return Promise.resolve(undefined);
        }
        return Promise.resolve({
            major: descriptor.s_desc ? descriptor.s_desc : descriptor.source.name,
            minor: descriptor.p_desc ? descriptor.p_desc : descriptor.parser.name,
            source: descriptor.source.name,
        });
    }

    static fromMinifiedStr(
        src: { [key: string]: number | string } | undefined,
    ): StreamDesc | undefined {
        return src === undefined
            ? undefined
            : new StreamDesc({
                  source: obj.getAsNotEmptyString(src, 's'),
                  major: obj.getAsString(src, 'ma'),
                  minor: obj.getAsString(src, 'mi'),
              });
    }

    public readonly source: string;
    public readonly major: string;
    public readonly minor: string;

    constructor(desc: IStreamDesc) {
        this.source = desc.source;
        this.major = desc.major;
        this.minor = desc.minor;
    }

    public isSame(stream: StreamDesc): boolean {
        console.error(`Not implemented`);
        return false;
        // return stream.source === this.source && this.major === stream.major;
    }

    public minify(): { [key: string]: number | string } {
        console.error(`Not implemented`);
        return {
            s: '',
            mi: this.minor,
            ma: this.major,
        };
    }
}
