import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { ilc, Emitter, Channel, Services } from '@service/ilc';
import { Session } from './session/session';
import { TabControls } from './session/tab';
import { File } from '@platform/types/files';
import { IDLTOptions } from '@platform/types/parsers/dlt';
import { SourceDefinition } from '@platform/types/transport';

import * as Files from './opener/files';
import * as Streams from './opener/streams';

export { Session, TabControls };

export interface StreamConnectFuncs {
    dlt(options?: IDLTOptions): Promise<void>;
    text(): Promise<void>;
    assign(session: Session | undefined): StreamConnectFuncs;
}

export interface FileOpenFuncs {
    text(): Promise<void>;
    dlt(options?: IDLTOptions): Promise<void>;
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
            text: (): Promise<void> => {
                return new Streams.Text(this._services, this.log())
                    .assign(scope)
                    .stream(source, undefined, openPresetSettings);
            },
            dlt: (options?: IDLTOptions): Promise<void> => {
                return new Streams.Dlt(this._services, this.log())
                    .assign(scope)
                    .stream(source, options, openPresetSettings);
            },
            assign: (session: Session | undefined): StreamConnectFuncs => {
                scope = session;
                return out;
            },
        };
        return out;
    }

    public file(file: File | string): FileOpenFuncs {
        let scope: Session | undefined;
        const out = {
            text: (): Promise<void> => {
                return new Files.Text(this._services, this.log())
                    .assign(scope)
                    .open(file, undefined);
            },
            dlt: (options?: IDLTOptions): Promise<void> => {
                return new Files.Dlt(this._services, this.log()).assign(scope).open(file, options);
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
