import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber } from '@platform/env/subscription';
import { cutUuid } from '@log/index';
import { Session } from '@service/session';
import { getFileName, getParentFolder } from '@platform/types/files';
import { env } from '@service/env';
import { cli } from '@service/cli';

@SetupLogger()
export class Cli extends Subscriber {
    protected session!: Session;
    protected _cmd: string = './chipmunk';

    //     protected source(): {
    //         stream(stream: $.Origin.Stream.Configuration): string | undefined;
    //         file(file: $.Origin.File.Configuration): string | undefined;
    //         concat(concat: $.Origin.Concat.Configuration): string | undefined;
    //         from(observed: $.Observe[]): string | undefined;
    //         cx(observed: $.Observe[]): $.Origin.Context | undefined;
    //     } {
    //         return {
    //             stream: (stream: $.Origin.Stream.Configuration): string | undefined => {
    //                 const serial = stream.as<$.Origin.Stream.Stream.Serial.Configuration>(
    //                     $.Origin.Stream.Stream.Serial.Configuration,
    //                 );
    //                 const tcp = stream.as<$.Origin.Stream.Stream.TCP.Configuration>(
    //                     $.Origin.Stream.Stream.TCP.Configuration,
    //                 );
    //                 const udp = stream.as<$.Origin.Stream.Stream.UDP.Configuration>(
    //                     $.Origin.Stream.Stream.UDP.Configuration,
    //                 );
    //                 const process = stream.as<$.Origin.Stream.Stream.Process.Configuration>(
    //                     $.Origin.Stream.Stream.Process.Configuration,
    //                 );
    //                 if (serial !== undefined) {
    //                     return `streams --serial "\
    // ${serial.configuration.path};\
    // ${serial.configuration.baud_rate};\
    // ${serial.configuration.data_bits};\
    // ${serial.configuration.flow_control};\
    // ${serial.configuration.parity};\
    // ${serial.configuration.stop_bits}"`;
    //                 } else if (tcp !== undefined) {
    //                     return `streams --tcp "${tcp.configuration.bind_addr}"`;
    //                 } else if (udp !== undefined) {
    //                     return `streams --udp "\
    // ${udp.configuration.bind_addr}|\
    // ${udp.configuration.multicast[0].multiaddr},\
    // ${udp.configuration.multicast[0].interface};"`;
    //                 } else if (process !== undefined) {
    //                     return `streams --stdout "${process.configuration.command}"`;
    //                 } else {
    //                     return undefined;
    //                 }
    //             },
    //             file: (file: $.Origin.File.Configuration): string | undefined => {
    //                 return `-o ${this.filename(file.get().filename())}`;
    //             },
    //             concat: (concat: $.Origin.Concat.Configuration): string | undefined => {
    //                 const relative =
    //                     Array.from(new Set(concat.files().map((f) => getParentFolder(f)))).length === 1;
    //                 return concat
    //                     .files()
    //                     .map((f) => `-o ${relative ? this.filename(f) : f}`)
    //                     .join(' ');
    //             },
    //             from: (observed: $.Observe[]): string | undefined => {
    //                 const get = (observe: $.Observe): string | undefined => {
    //                     const stream = observe.origin.as<$.Origin.Stream.Configuration>(
    //                         $.Origin.Stream.Configuration,
    //                     );
    //                     const file = observe.origin.as<$.Origin.File.Configuration>(
    //                         $.Origin.File.Configuration,
    //                     );
    //                     const concat = observe.origin.as<$.Origin.Concat.Configuration>(
    //                         $.Origin.Concat.Configuration,
    //                     );
    //                     if (stream !== undefined) {
    //                         return this.source().stream(stream);
    //                     } else if (file !== undefined) {
    //                         return this.source().file(file);
    //                     } else if (concat !== undefined) {
    //                         return this.source().concat(concat);
    //                     } else {
    //                         return undefined;
    //                     }
    //                 };
    //                 if (observed.length === 0) {
    //                     return undefined;
    //                 }
    //                 let args = '';
    //                 for (const observe of observed) {
    //                     const arg = get(observe);
    //                     if (arg === undefined) {
    //                         return undefined;
    //                     }
    //                     args = `${args}${args.length === 0 ? '' : ' '}${arg}`;
    //                 }
    //                 return args;
    //             },
    //             cx(observed: $.Observe[]): $.Origin.Context | undefined {
    //                 function get(observe: $.Observe): $.Origin.Context | undefined {
    //                     if (
    //                         observe.origin.as<$.Origin.Stream.Configuration>(
    //                             $.Origin.Stream.Configuration,
    //                         ) !== undefined
    //                     ) {
    //                         return $.Origin.Context.Stream;
    //                     } else if (
    //                         observe.origin.as<$.Origin.File.Configuration>(
    //                             $.Origin.File.Configuration,
    //                         ) !== undefined
    //                     ) {
    //                         return $.Origin.Context.File;
    //                     } else if (
    //                         observe.origin.as<$.Origin.Concat.Configuration>(
    //                             $.Origin.Concat.Configuration,
    //                         ) !== undefined
    //                     ) {
    //                         return $.Origin.Context.Concat;
    //                     } else {
    //                         return undefined;
    //                     }
    //                 }
    //                 if (observed.length === 0 || get(observed[0]) === undefined) {
    //                     return undefined;
    //                 }
    //                 const first: $.Origin.Context = get(observed[0]) as unknown as $.Origin.Context;
    //                 for (const observe of observed) {
    //                     if (first !== get(observe)) {
    //                         return undefined;
    //                     }
    //                 }
    //                 return first;
    //             },
    //         };
    //     }

    //     protected parser(): {
    //         text(parser: $.Parser.Text.Configuration): string | undefined;
    //         dlt(parser: $.Parser.Dlt.Configuration): string | undefined;
    //         someip(parser: $.Parser.SomeIp.Configuration): string | undefined;
    //         from(observe: $.Observe): string | undefined;
    //     } {
    //         return {
    //             text: (_parser: $.Parser.Text.Configuration): string | undefined => {
    //                 return `--parser text`;
    //             },
    //             dlt: (_parser: $.Parser.Dlt.Configuration): string | undefined => {
    //                 return `--parser dlt`;
    //             },
    //             someip: (_parser: $.Parser.SomeIp.Configuration): string | undefined => {
    //                 return `--parser someip`;
    //             },
    //             from: (observe: $.Observe): string | undefined => {
    //                 const text = observe.parser.as<$.Parser.Text.Configuration>(
    //                     $.Parser.Text.Configuration,
    //                 );
    //                 const dlt = observe.parser.as<$.Parser.Dlt.Configuration>(
    //                     $.Parser.Dlt.Configuration,
    //                 );
    //                 const someip = observe.parser.as<$.Parser.SomeIp.Configuration>(
    //                     $.Parser.SomeIp.Configuration,
    //                 );
    //                 if (text !== undefined) {
    //                     return this.parser().text(text);
    //                 } else if (dlt !== undefined) {
    //                     return this.parser().dlt(dlt);
    //                 } else if (someip !== undefined) {
    //                     return this.parser().someip(someip);
    //                 } else {
    //                     return undefined;
    //                 }
    //             },
    //         };
    //     }

    protected filters(): string {
        const filters = this.session.search.store().filters().get();
        if (filters.length === 0) {
            return '';
        }
        return `${filters
            .map((f) => `-s "${f.as().filter().filter.replaceAll('"', '\\"')}"`)
            .join(' ')}`;
    }

    protected cmd(): {
        update(): Promise<void>;
        get(): string;
        defaults(): void;
    } {
        return {
            update: (): Promise<void> => {
                return cli
                    .getCommand()
                    .then((cmd) => {
                        this._cmd = cmd;
                    })
                    .catch((err: Error) => {
                        this.log().error(`Fail to get CLI command/executor value: ${err.message}`);
                        this.cmd().defaults();
                    });
            },
            get: (): string => {
                return this._cmd;
            },
            defaults: (): void => {
                if (env.platform().windows()) {
                    this._cmd = `chipmunk.exe`;
                } else {
                    this._cmd = `./chipmunk`;
                }
            },
        };
    }

    protected filename(fullpath: string): string {
        if (env.platform().windows()) {
            return getFileName(fullpath);
        } else {
            return `./${getFileName(fullpath)}`;
        }
    }

    protected arguments(): string | undefined {
        console.error(`Not implemented`);
        // const operations = this.session.stream
        //     .observe()
        //     .operations()
        //     .map((s) => s.isRunning());
        // if (operations.length === 0) {
        //     return undefined;
        // }
        // if (this.source().cx(operations) === undefined) {
        //     // Not the same origin
        //     return undefined;
        // }
        // const source = this.source().from(operations);
        // if (source === undefined) {
        //     return undefined;
        // }
        // const parser = this.parser().from(operations[0]);
        // if (parser === undefined) {
        //     return undefined;
        // }
        // return `${source} ${parser} ${this.filters()}`;
        return;
    }

    public init(session: Session) {
        this.session = session;
        this.setLoggerName(`Cli: ${cutUuid(session.uuid())}`);
    }

    public destroy() {
        this.unsubscribe();
    }

    public async generate(): Promise<string | undefined> {
        await this.cmd().update();
        const args = this.arguments();
        if (args === undefined) {
            return undefined;
        }
        return `${this.cmd().get()} ${args}`;
    }

    public isSupported(): boolean {
        return this.arguments() !== undefined;
    }
}
export interface Cli extends LoggerInterface {}
