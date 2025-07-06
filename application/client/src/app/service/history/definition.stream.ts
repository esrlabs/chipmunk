import { SessionOrigin } from '@service/session/origin';

import * as obj from '@platform/env/obj';

export interface IStreamDesc {
    origin: SessionOrigin;
    major: string;
    minor: string;
}

export class StreamDesc implements IStreamDesc {
    static async fromDataSource(origin: SessionOrigin): Promise<IStreamDesc | undefined> {
        return Promise.reject(new Error(`Not implemented`));

        // const stream = source.origin.as<$.Origin.Stream.Configuration>(
        //     $.Origin.Stream.Configuration,
        // );
        // if (stream === undefined) {
        //     return undefined;
        // }
        // const def = stream.desc();
        // return {
        //     major: def.major,
        //     minor: def.minor,
        //     source: stream.instance.instance.alias(),
        // };
    }

    static fromMinifiedStr(
        src: { [key: string]: number | string } | undefined,
    ): StreamDesc | undefined {
        console.error(`Not implemented`);
        return undefined;
        // return src === undefined
        //     ? undefined
        //     : new StreamDesc({
        //           origin: obj.getAsNotEmptyString(src, 's') as $.Origin.Stream.Stream.Source,
        //           major: obj.getAsString(src, 'ma'),
        //           minor: obj.getAsString(src, 'mi'),
        //       });
    }

    public origin: SessionOrigin;
    public major: string;
    public minor: string;

    constructor(definition: IStreamDesc) {
        this.origin = definition.origin;
        this.major = definition.major;
        this.minor = definition.minor;
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
