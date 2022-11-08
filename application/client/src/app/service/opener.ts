import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { ilc, Emitter, Channel, Services } from '@service/ilc';
import { Session } from './session/session';
import { TabControls } from './session/tab';
import { File } from '@platform/types/files';
import { SourceDefinition } from '@platform/types/transport';
import { IDLTOptions, parserSettingsToOptions } from '@platform/types/parsers/dlt';

import * as Files from './opener/file/index';
import * as Concat from './opener/concat/index';
import * as Streams from './opener/stream/index';
import { DataSource } from './session/dependencies/stream';

export { Session, TabControls };

export interface StreamConnectFuncs {
    dlt(options?: IDLTOptions): Promise<string>;
    text(options?: {}): Promise<string>;
    source(src: DataSource): Promise<string>;
    assign(session: Session | undefined): StreamConnectFuncs;
}

export interface FileOpenFuncs {
    text(): Promise<string>;
    dlt(options?: IDLTOptions): Promise<string>;
    assign(session: Session | undefined): FileOpenFuncs;
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

    public stream(source?: SourceDefinition, openPresetSettings?: boolean): StreamConnectFuncs {
        let scope: Session | undefined;
        const out = {
            text: (options?: {}): Promise<string> => {
                return new Streams.Text(this._services, this.log())
                    .assign(scope)
                    .stream(source, options, openPresetSettings);
            },
            dlt: (options?: IDLTOptions): Promise<string> => {
                return new Streams.Dlt(this._services, this.log())
                    .assign(scope)
                    .stream(source, options, openPresetSettings);
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
        };
        return out;
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
            assign: (session: Session | undefined): FileOpenFuncs => {
                scope = session;
                return out;
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
            assign: (session: Session | undefined): FileOpenFuncs => {
                scope = session;
                return out;
            },
        };
        return out;
    }
}
export interface Service extends Interface {}
export const opener = register(new Service());
