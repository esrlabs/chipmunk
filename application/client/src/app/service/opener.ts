import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { ilc, Emitter, Channel, Services } from '@service/ilc';
import { Session } from './session/session';
import { TabControls } from './session/tab';
import { File, FileType } from '@platform/types/files';
import { SourceDefinition, Source as SourceRef } from '@platform/types/transport';
import { IDLTOptions, parserSettingsToOptions } from '@platform/types/parsers/dlt';
import { DataSource, ParserName } from '@platform/types/observe';

import * as Files from './opener/file/index';
import * as Concat from './opener/concat/index';
import * as Streams from './opener/stream/index';

export { Session, TabControls, SourceRef, ParserName };

export interface StreamConnectFuncs {
    dlt(options?: IDLTOptions): Promise<string>;
    text(options?: {}): Promise<string>;
    source(src: DataSource): Promise<string>;
    assign(session: Session | undefined): StreamConnectFuncs;
    byParser(parser: ParserName): Promise<string>;
}

export interface FileOpenFuncs {
    text(): Promise<string>;
    dlt(options?: IDLTOptions): Promise<string>;
    pcap(options?: IDLTOptions): Promise<string>;
    assign(session: Session | undefined): FileOpenFuncs;
    byParser(parser: ParserName): Promise<string>;
    auto(): Promise<string>;
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
            assign: (session: Session | undefined): StreamConnectFuncs => {
                scope = session;
                return out;
            },
            source: (src: DataSource): Promise<string> => {
                if (src.origin.Stream === undefined) {
                    return Promise.reject(new Error(`Operation is available only for streams`));
                }
                if (src.parser.Dlt !== undefined) {
                    return out.dlt(parserSettingsToOptions(src.parser.Dlt));
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
            const open = this.file(origin.File[1]);
            if (parser.Text !== undefined) {
                return open.text();
            } else if (parser.Dlt !== undefined) {
                return open.dlt(parserSettingsToOptions(parser.Dlt));
            } else if (parser.Pcap !== undefined) {
                return open.pcap(parserSettingsToOptions(parser.Pcap.dlt));
            } else {
                return Promise.reject(new Error(`Unsupported parser`));
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
            const concat = this.concat(origin.Concat.map((c) => c[1]));
            if (parser.Text !== undefined) {
                return concat.text();
            } else if (parser.Dlt !== undefined) {
                return concat.dlt(parserSettingsToOptions(parser.Dlt));
            } else if (parser.Pcap !== undefined) {
                return concat.pcap(parserSettingsToOptions(parser.Pcap.dlt));
            } else {
                return Promise.reject(new Error(`Unsupported parser`));
            }
        } else {
            return Promise.reject(new Error(`Unsupported source of data`));
        }
    }

    public file(file: File | string): FileOpenFuncs {
        let scope: Session | undefined;
        const out = {
            text: (): Promise<string> => {
                return new Files.Text(this._services, this.log())
                    .assign(scope)
                    .open(file, undefined);
            },
            dlt: (options?: IDLTOptions): Promise<string> => {
                return new Files.Dlt(this._services, this.log()).assign(scope).open(file, options);
            },
            pcap: (options?: IDLTOptions): Promise<string> => {
                return new Files.Pcap(this._services, this.log()).assign(scope).open(file, options);
            },
            assign: (session: Session | undefined): FileOpenFuncs => {
                scope = session;
                return out;
            },
            byParser: (parser: ParserName): Promise<string> => {
                if (parser === ParserName.Dlt) {
                    return new Files.Dlt(this._services, this.log())
                        .assign(scope)
                        .open(file, undefined);
                } else if (parser === ParserName.Pcap) {
                    return new Files.Pcap(this._services, this.log())
                        .assign(scope)
                        .open(file, undefined);
                } else if (parser === ParserName.Text) {
                    return new Files.Text(this._services, this.log())
                        .assign(scope)
                        .open(file, undefined);
                } else {
                    return Promise.reject(
                        new Error(`Parser ${parser} isn't supported for stream.`),
                    );
                }
            },
            auto: async (): Promise<string> => {
                if (typeof file === 'string') {
                    const data = await this._services.system.bridge.files().getByPath([file]);
                    if (data.length !== 1) {
                        return Promise.reject(new Error(`Fail to get info about file: ${file}`));
                    }
                    file = data[0];
                }
                switch (file.type) {
                    case FileType.Dlt:
                        return this.file(file).dlt();
                    case FileType.Pcap:
                        return this.file(file).pcap();
                    default:
                        return this.file(file).text();
                }
            },
        };
        return out;
    }

    public concat(files: File[] | string[]): FileOpenFuncs {
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
            pcap: (options?: IDLTOptions): Promise<string> => {
                return new Concat.Pcap(this._services, this.log())
                    .assign(scope)
                    .open(files, options);
            },
            assign: (session: Session | undefined): FileOpenFuncs => {
                scope = session;
                return out;
            },
            byParser: (parser: ParserName): Promise<string> => {
                if (parser === ParserName.Dlt) {
                    return new Concat.Dlt(this._services, this.log())
                        .assign(scope)
                        .open(files, undefined);
                } else if (parser === ParserName.Pcap) {
                    return new Concat.Pcap(this._services, this.log())
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
            auto: (): Promise<string> => {
                return Promise.reject(
                    new Error(`Auto detection of file type of concat isn't implemented`),
                );
            },
        };
        return out;
    }
}
export interface Service extends Interface {}
export const opener = register(new Service());
