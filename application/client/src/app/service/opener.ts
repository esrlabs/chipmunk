import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { ilc, Emitter, Channel, Services } from '@service/ilc';
import { Session } from './session/session';
import { TabControls } from './session/tab';
import { File } from '@platform/types/files';
import { FileType } from '@platform/types/observe';
import { SourceDefinition, Source as SourceRef } from '@platform/types/transport';
import {
    IDLTOptions,
    parserSettingsToOptions as parserDLTSettingsToOptions,
} from '@platform/types/parsers/dlt';
import {
    ISomeIpOptions,
    parserSettingsToOptions as parserSomeIpSettingsToOptions,
} from '@platform/types/parsers/someip';
import { DataSource, ParserName } from '@platform/types/observe';

import * as Files from './opener/file/index';
import * as Concat from './opener/concat/index';
import * as Streams from './opener/stream/index';

export { Session, TabControls, SourceRef, ParserName };

export interface StreamConnectFuncs {
    dlt(options?: IDLTOptions): Promise<string>;
    someip(options?: ISomeIpOptions): Promise<string>;
    text(options?: {}): Promise<string>;
    source(src: DataSource): Promise<string>;
    assign(session: Session | undefined): StreamConnectFuncs;
    byParser(parser: ParserName): Promise<string>;
}

export interface ITextFileFuncs {
    text(): Promise<string>;
    assign(session: Session | undefined): ITextFileFuncs;
}

export interface IBinaryFileFuncs {
    dlt(options?: IDLTOptions): Promise<string>;
    assign(session: Session | undefined): IBinaryFileFuncs;
}

export interface IPcapFileFuncs {
    dlt(options?: IDLTOptions): Promise<string>;
    someip(options?: ISomeIpOptions): Promise<string>;
    assign(session: Session | undefined): IPcapFileFuncs;
}

export interface IConcatFuncs {
    text(): Promise<string>;
    dlt(options?: IDLTOptions): Promise<string>;
    someip(options?: ISomeIpOptions): Promise<string>;
    assign(session: Session | undefined): IConcatFuncs;
    byParser(parser: ParserName): Promise<string>;
}

@SetupService(services['opener'])
export class Service extends Implementation {
    private _emitter!: Emitter;
    private _channel!: Channel;
    private _services!: Services;

    public override ready(): Promise<void> {
        this._emitter = ilc.emitter(this.getName(), this.log());
        this._channel = ilc.channel(this.getName(), this.log());
        this._services = ilc.services(this.getName(), this.log());
        return Promise.resolve();
    }

    public stream(
        source: SourceDefinition | undefined,
        openPresetSettings: boolean | undefined,
        preselected: SourceRef | undefined,
    ): StreamConnectFuncs {
        let scope: Session | undefined;
        const out = {
            text: (options?: {}): Promise<string> => {
                return new Streams.Text(this._services, this.log())
                    .assign(scope)
                    .stream(source, options, openPresetSettings, preselected);
            },
            dlt: (options?: IDLTOptions): Promise<string> => {
                return new Streams.Dlt(this._services, this.log())
                    .assign(scope)
                    .stream(source, options, openPresetSettings, preselected);
            },
            someip: (options?: ISomeIpOptions): Promise<string> => {
                return new Streams.SomeIp(this._services, this.log())
                    .assign(scope)
                    .stream(source, options, openPresetSettings, preselected);
            },
            assign: (session: Session | undefined): StreamConnectFuncs => {
                scope = session;
                return out;
            },
            source: (src: DataSource): Promise<string> => {
                if (src.origin.Stream === undefined) {
                    return Promise.reject(new Error(`Operation is available only for streams`));
                }
                if (src.parser.Dlt !== undefined) {
                    return out.dlt(parserDLTSettingsToOptions(src.parser.Dlt));
                } else if (src.parser.Someip !== undefined) {
                    return out.someip(parserSomeIpSettingsToOptions(src.parser.Someip));
                } else if (src.parser.Text !== undefined) {
                    return out.text();
                }
                return Promise.reject(new Error(`Unsupported type of source`));
            },
            byParser: (parser: ParserName): Promise<string> => {
                if (parser === ParserName.Dlt) {
                    return new Streams.Dlt(this._services, this.log())
                        .assign(scope)
                        .stream(source, undefined, openPresetSettings, preselected);
                } else if (parser === ParserName.Text) {
                    return new Streams.Text(this._services, this.log())
                        .assign(scope)
                        .stream(source, undefined, openPresetSettings, preselected);
                } else if (parser === ParserName.Someip) {
                    return new Streams.SomeIp(this._services, this.log())
                        .assign(scope)
                        .stream(source, undefined, openPresetSettings, preselected);
                } else {
                    return Promise.reject(
                        new Error(`Parser ${parser} isn't supported for stream.`),
                    );
                }
            },
        };
        return out;
    }

    public from(source: DataSource): Promise<string> {
        const origin = source.origin;
        const parser = source.parser;
        if (origin.File !== undefined) {
            switch (origin.File[1]) {
                case FileType.Text:
                    return this.text(origin.File[2]).text();
                case FileType.Binary:
                    if (parser.Dlt !== undefined) {
                        return this.binary(origin.File[2]).dlt(
                            parserDLTSettingsToOptions(parser.Dlt),
                        );
                    } else {
                        return Promise.reject(
                            `Parser ${parser} isn't supported with binary source`,
                        );
                    }
                case FileType.Pcap:
                    if (parser.Dlt !== undefined) {
                        return this.pcap(origin.File[2]).dlt(
                            parserDLTSettingsToOptions(parser.Dlt),
                        );
                    } else if (parser.Someip !== undefined) {
                        return this.pcap(origin.File[2]).someip(
                            parserSomeIpSettingsToOptions(parser.Someip),
                        );
                    } else {
                        return Promise.reject(
                            `Parser ${parser} isn't supported with binary source`,
                        );
                    }
            }
        } else if (origin.Stream !== undefined) {
            const sourceDef = source.asSourceDefinition();
            const sourceRef = source.asSourceRef();
            if (sourceDef instanceof Error) {
                return Promise.reject(sourceDef);
            }
            return this.stream(
                sourceDef,
                false,
                sourceRef instanceof Error ? undefined : sourceRef,
            ).source(source);
        } else if (origin.Concat !== undefined) {
            const concat = this.concat(origin.Concat.map((c) => c[2]));
            if (parser.Text !== undefined) {
                return concat.text();
            } else if (parser.Dlt !== undefined) {
                return concat.dlt(parserDLTSettingsToOptions(parser.Dlt));
            } else if (parser.Someip !== undefined) {
                return concat.someip(parserSomeIpSettingsToOptions(parser.Someip));
            } else {
                return Promise.reject(new Error(`Unsupported parser`));
            }
        } else {
            return Promise.reject(new Error(`Unsupported source of data`));
        }
    }

    public text(file: File | string): ITextFileFuncs {
        let scope: Session | undefined;
        const output: ITextFileFuncs = {
            text: (): Promise<string> => {
                return new Files.Text(this._services, this.log())
                    .assign(scope)
                    .open(file, undefined);
            },
            assign: (session: Session | undefined): ITextFileFuncs => {
                scope = session;
                return output;
            },
        };
        return output;
    }

    public binary(file: File | string): IBinaryFileFuncs {
        let scope: Session | undefined;
        const output: IBinaryFileFuncs = {
            dlt: (options?: IDLTOptions): Promise<string> => {
                return new Files.Dlt(this._services, this.log()).assign(scope).open(file, options);
            },
            assign: (session: Session | undefined): IBinaryFileFuncs => {
                scope = session;
                return output;
            },
        };
        return output;
    }

    public pcap(file: File | string): IPcapFileFuncs {
        let scope: Session | undefined;
        const output: IPcapFileFuncs = {
            dlt: (options?: IDLTOptions): Promise<string> => {
                return new Files.DltInPcap(this._services, this.log())
                    .assign(scope)
                    .open(file, options);
            },
            someip: (options?: ISomeIpOptions): Promise<string> => {
                return new Files.SomeIpInPcap(this._services, this.log())
                    .assign(scope)
                    .open(file, options);
            },
            assign: (session: Session | undefined): IPcapFileFuncs => {
                scope = session;
                return output;
            },
        };
        return output;
    }

    public concat(files: File[] | string[]): IConcatFuncs {
        let scope: Session | undefined;
        const out = {
            text: (): Promise<string> => {
                return new Concat.Text(this._services, this.log())
                    .assign(scope)
                    .open(files, undefined);
            },
            dlt: (options?: IDLTOptions): Promise<string> => {
                return new Concat.Dlt(this._services, this.log())
                    .assign(scope)
                    .open(files, options);
            },
            someip: (options?: ISomeIpOptions): Promise<string> => {
                return new Concat.SomeIp(this._services, this.log())
                    .assign(scope)
                    .open(files, options);
            },
            assign: (session: Session | undefined): IConcatFuncs => {
                scope = session;
                return out;
            },
            byParser: (parser: ParserName): Promise<string> => {
                if (parser === ParserName.Dlt) {
                    return new Concat.Dlt(this._services, this.log())
                        .assign(scope)
                        .open(files, undefined);
                } else if (parser === ParserName.Someip) {
                    return new Concat.SomeIp(this._services, this.log())
                        .assign(scope)
                        .open(files, undefined);
                } else if (parser === ParserName.Text) {
                    return new Concat.Text(this._services, this.log())
                        .assign(scope)
                        .open(files, undefined);
                } else {
                    return Promise.reject(
                        new Error(`Parser ${parser} isn't supported for stream.`),
                    );
                }
            },
        };
        return out;
    }
}
export interface Service extends Interface {}
export const opener = register(new Service());
