import * as $ from './index';

export { FileType } from './types/file/index';

class Factory<T> {
    protected changes: { parser: boolean; origin: boolean } = { parser: false, origin: false };

    protected updated(): {
        parser(): void;
        origin(): void;
    } {
        const update = () => {
            if (this.changes.origin === this.changes.parser) {
                // No needs to update if and parser and origin were changed or weren't changed both
                return;
            }
            if (this.changes.origin) {
                const parsers = this.observe.origin.getSupportedParsers();
                if (parsers.length === 0) {
                    throw new Error(
                        `No supported parser for ${this.observe.origin.instance.alias()}`,
                    );
                }
                this.protocol(parsers[0].alias());
            } else if (this.changes.parser) {
                // TODO: check source also
                // switch (this.observe.origin.instance.alias()) {
                //     case $.Origin.Context.File:
                //         const _filetypes = this.observe.parser.getSupportedFileType();
                //         break;
                //     case $.Origin.Context.Concat:
                //         const _filetypes = this.observe.parser.getSupportedFileType();
                //         break;
                //     case $.Origin.Context.Stream:
                //         const _streams = this.observe.parser
                //             .getSupportedStream()
                //             .map((r) => r.alias());
                //         break;
                // }
            }
        };
        return {
            parser: (): void => {
                this.changes.parser = true;
                update();
            },
            origin: (): void => {
                this.changes.origin = true;
                update();
            },
        };
    }

    protected observe: $.Observe = $.Observe.new();

    public protocol(protocol: $.Parser.Protocol): T {
        this.observe.parser.change($.Parser.getByAlias(protocol));
        this.updated().parser();
        return this as unknown as T;
    }

    public asDlt(configuration?: $.Parser.Dlt.IConfiguration): T {
        this.observe.parser.change(
            new $.Parser.Dlt.Configuration(
                configuration === undefined ? $.Parser.Dlt.Configuration.initial() : configuration,
                undefined,
            ),
        );
        this.updated().parser();
        return this as unknown as T;
    }

    public asSomeip(configuration?: $.Parser.SomeIp.IConfiguration): T {
        this.observe.parser.change(
            new $.Parser.SomeIp.Configuration(
                configuration === undefined
                    ? $.Parser.SomeIp.Configuration.initial()
                    : configuration,
                undefined,
            ),
        );
        this.updated().parser();
        return this as unknown as T;
    }

    public parser(parser: $.Parser.Declaration): T {
        this.observe.parser.change(parser);
        return this as unknown as T;
    }

    public asText(): T {
        this.observe.parser.change(new $.Parser.Text.Configuration(null, undefined));
        this.updated().parser();
        return this as unknown as T;
    }

    public guessParser(): T {
        const parsers = this.observe.origin.getSupportedParsers();
        if (parsers.length === 0) {
            throw new Error(
                `Origin "${this.observe.origin.getNatureAlias()}" doesn't have any suitable parseres.`,
            );
        }
        const Ref = parsers[0];
        this.observe.parser.change(new Ref(Ref.initial(), undefined));
        this.updated().parser();
        return this as unknown as T;
    }

    public get(): $.Observe {
        const parsers = this.observe.origin.getSupportedParsers().map((ref) => ref.alias());
        const selected = this.observe.parser.alias();
        if (!parsers.includes(selected)) {
            throw new Error(
                `Origin "${this.observe.origin.getNatureAlias()}" doesn't support parser: ${selected}; available parsers: ${parsers.join(
                    ', ',
                )}.`,
            );
        }
        return this.observe;
    }
}

export class File extends Factory<File> {
    static FileType = $.Types.File.FileType;

    constructor() {
        super();
        this.observe.origin.change(
            new $.Origin.File.Configuration($.Origin.File.Configuration.initial(), undefined),
        );
    }

    public alias(alias: string): File {
        if (!(this.observe.origin.instance instanceof $.Origin.File.Configuration)) {
            throw new Error(`Given observe object doesn't have File origin`);
        }
        this.observe.origin.instance.set().alias(alias);
        this.updated().origin();
        return this;
    }

    public file(filename: string): File {
        if (!(this.observe.origin.instance instanceof $.Origin.File.Configuration)) {
            throw new Error(`Given observe object doesn't have File origin`);
        }
        this.observe.origin.instance.set().filename(filename);
        this.updated().origin();
        return this;
    }

    public type(type: $.Types.File.FileType): File {
        if (!(this.observe.origin.instance instanceof $.Origin.File.Configuration)) {
            throw new Error(`Given observe object doesn't have File origin`);
        }
        this.observe.origin.instance.set().type(type);
        this.updated().origin();
        return this;
    }
}

export class Concat extends Factory<Concat> {
    static FileType = $.Types.File.FileType;

    constructor() {
        super();
        this.observe.origin.change(
            new $.Origin.Concat.Configuration($.Origin.Concat.Configuration.initial(), undefined),
        );
    }

    public files(files: string[]): Concat {
        if (!(this.observe.origin.instance instanceof $.Origin.Concat.Configuration)) {
            throw new Error(`Given observe object doesn't have Concat origin`);
        }
        this.observe.origin.instance.set().files(files);
        this.updated().origin();
        return this;
    }

    public type(type: $.Types.File.FileType): Concat {
        if (!(this.observe.origin.instance instanceof $.Origin.Concat.Configuration)) {
            throw new Error(`Given observe object doesn't have Concat origin`);
        }
        this.observe.origin.instance.set().defaults(type);
        this.updated().origin();
        return this;
    }

    public push(filename: string, type: $.Types.File.FileType): Concat {
        if (!(this.observe.origin.instance instanceof $.Origin.Concat.Configuration)) {
            throw new Error(`Given observe object doesn't have Concat origin`);
        }
        this.observe.origin.instance.set().push(filename, type);
        this.updated().origin();
        return this;
    }

    public remove(filename: string): Concat {
        if (!(this.observe.origin.instance instanceof $.Origin.Concat.Configuration)) {
            throw new Error(`Given observe object doesn't have Concat origin`);
        }
        this.observe.origin.instance.set().remove(filename);
        this.updated().origin();
        return this;
    }
}

export class Stream extends Factory<Stream> {
    constructor() {
        super();
        this.observe.origin.change(
            new $.Origin.Stream.Configuration($.Origin.Stream.Configuration.initial(), undefined),
        );
    }

    public process(configuration?: $.Origin.Stream.Stream.Process.IConfiguration): Stream {
        if (!(this.observe.origin.instance instanceof $.Origin.Stream.Configuration)) {
            throw new Error(`Given observe object doesn't have Stream origin`);
        }
        this.observe.origin.instance.change(
            new $.Origin.Stream.Stream.Process.Configuration(
                configuration !== undefined
                    ? configuration
                    : $.Origin.Stream.Stream.Process.Configuration.initial(),
                undefined,
            ),
        );
        this.updated().origin();
        return this;
    }

    public serial(configuration?: $.Origin.Stream.Stream.Serial.IConfiguration): Stream {
        if (!(this.observe.origin.instance instanceof $.Origin.Stream.Configuration)) {
            throw new Error(`Given observe object doesn't have Stream origin`);
        }
        this.observe.origin.instance.change(
            new $.Origin.Stream.Stream.Serial.Configuration(
                configuration !== undefined
                    ? configuration
                    : $.Origin.Stream.Stream.Serial.Configuration.initial(),
                undefined,
            ),
        );
        this.updated().origin();
        return this;
    }

    public tcp(configuration?: $.Origin.Stream.Stream.TCP.IConfiguration): Stream {
        if (!(this.observe.origin.instance instanceof $.Origin.Stream.Configuration)) {
            throw new Error(`Given observe object doesn't have Stream origin`);
        }
        this.observe.origin.instance.change(
            new $.Origin.Stream.Stream.TCP.Configuration(
                configuration !== undefined
                    ? configuration
                    : $.Origin.Stream.Stream.TCP.Configuration.initial(),
                undefined,
            ),
        );
        this.updated().origin();
        return this;
    }

    public udp(configuration?: $.Origin.Stream.Stream.UDP.IConfiguration): Stream {
        if (!(this.observe.origin.instance instanceof $.Origin.Stream.Configuration)) {
            throw new Error(`Given observe object doesn't have Stream origin`);
        }
        this.observe.origin.instance.change(
            new $.Origin.Stream.Stream.UDP.Configuration(
                configuration !== undefined
                    ? configuration
                    : $.Origin.Stream.Stream.UDP.Configuration.initial(),
                undefined,
            ),
        );
        this.updated().origin();
        return this;
    }
}

export function map(observe: $.Observe): {
    file(): boolean;
    concat(): boolean;
    process(): boolean;
    serial(): boolean;
    udp(): boolean;
    tcp(): boolean;
} {
    return {
        file: (): boolean => {
            return (
                observe.origin.as<$.Origin.File.Configuration>($.Origin.File.Configuration) !==
                undefined
            );
        },
        concat: (): boolean => {
            return (
                observe.origin.as<$.Origin.Concat.Configuration>($.Origin.Concat.Configuration) !==
                undefined
            );
        },
        process: (): boolean => {
            const stream = observe.origin.as<$.Origin.Stream.Configuration>(
                $.Origin.Stream.Configuration,
            );
            if (stream === undefined) {
                return false;
            }
            return (
                stream.as<$.Origin.Stream.Stream.Process.Configuration>(
                    $.Origin.Stream.Stream.Process.Configuration,
                ) !== undefined
            );
        },
        serial: (): boolean => {
            const stream = observe.origin.as<$.Origin.Stream.Configuration>(
                $.Origin.Stream.Configuration,
            );
            if (stream === undefined) {
                return false;
            }
            return (
                stream.as<$.Origin.Stream.Stream.Serial.Configuration>(
                    $.Origin.Stream.Stream.Serial.Configuration,
                ) !== undefined
            );
        },
        udp: (): boolean => {
            const stream = observe.origin.as<$.Origin.Stream.Configuration>(
                $.Origin.Stream.Configuration,
            );
            if (stream === undefined) {
                return false;
            }
            return (
                stream.as<$.Origin.Stream.Stream.UDP.Configuration>(
                    $.Origin.Stream.Stream.UDP.Configuration,
                ) !== undefined
            );
        },
        tcp: (): boolean => {
            const stream = observe.origin.as<$.Origin.Stream.Configuration>(
                $.Origin.Stream.Configuration,
            );
            if (stream === undefined) {
                return false;
            }
            return (
                stream.as<$.Origin.Stream.Stream.TCP.Configuration>(
                    $.Origin.Stream.Stream.TCP.Configuration,
                ) !== undefined
            );
        },
    };
}
