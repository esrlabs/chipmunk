import * as $ from '@platform/types/observe';
import * as obj from '@platform/env/obj';

export interface IStreamDesc {
    source: $.Origin.Stream.Stream.Source;
    major: string;
    minor: string;
}

export class StreamDesc implements IStreamDesc {
    static async fromDataSource(source: $.Observe): Promise<IStreamDesc | undefined> {
        const stream = source.origin.as<$.Origin.Stream.Configuration>(
            $.Origin.Stream.Configuration,
        );
        if (stream === undefined) {
            return undefined;
        }
        const def = stream.desc();
        return {
            major: def.major,
            minor: def.minor,
            source: stream.instance.instance.alias(),
        };
    }

    static fromMinifiedStr(
        src: { [key: string]: number | string } | undefined,
    ): StreamDesc | undefined {
        return src === undefined
            ? undefined
            : new StreamDesc({
                  source: obj.getAsNotEmptyString(src, 's') as $.Origin.Stream.Stream.Source,
                  major: obj.getAsString(src, 'ma'),
                  minor: obj.getAsString(src, 'mi'),
              });
    }

    public source: $.Origin.Stream.Stream.Source;
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
