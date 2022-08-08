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
        source?: SourceDefinition,
        openPresetSettings?: boolean,
    ): {
        dlt(options?: IDLTOptions): Promise<void>;
        text(): Promise<void>;
    } {
        return {
            text: (): Promise<void> => {
                return new Streams.Text(this._services, this.log()).stream(
                    source,
                    undefined,
                    openPresetSettings,
                );
            },
            dlt: (options?: IDLTOptions): Promise<void> => {
                return new Streams.Dlt(this._services, this.log()).stream(
                    source,
                    options,
                    openPresetSettings,
                );
            },
        };
    }

    public file(file: File | string): {
        text(): Promise<void>;
        dlt(options?: IDLTOptions): Promise<void>;
    } {
        return {
            text: (): Promise<void> => {
                return new Files.Text(this._services, this.log()).open(file, undefined);
            },
            dlt: (options?: IDLTOptions): Promise<void> => {
                return new Files.Dlt(this._services, this.log()).open(file, options);
            },
        };
    }
}
export interface Service extends Interface {}
export const opener = register(new Service());
