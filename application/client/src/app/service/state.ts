import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from '@platform/entity/service';
import { services } from '@register/services';
import { ilc, Emitter, Services, Declarations } from '@service/ilc';
import { Subscriber } from '@platform/env/subscription';
import * as Events from '@platform/ipc/event/index';

@SetupService(services['state'])
export class Service extends Implementation {
    private _emitter!: Emitter;
    private _subscriber: Subscriber = new Subscriber();

    public override ready(): Promise<void> {
        this._emitter = ilc.emitter(this.getName(), this.log());
        this._subscriber.register(
            Events.IpcEvent.subscribe<Events.State.Backend.Event>(
                Events.State.Backend.Event,
                (event) => {
                    this._emitter.backend.state({
                        state: (() => {
                            switch (event.state) {
                                case Events.State.Backend.State.Ready:
                                    this._emitter.system.ready();
                                    return Declarations.BackendState.Ready;
                                case Events.State.Backend.State.Locked:
                                    return Declarations.BackendState.Locked;
                            }
                            throw new Error(`Unknown backend state: "${event.state}"`);
                        })(),
                        job: event.job,
                    });
                },
            ),
        );
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this._subscriber.unsubscribe();
        return Promise.resolve();
    }

    public setClientAsReady() {
        Events.IpcEvent.emit(
            new Events.State.Client.Event({
                state: Events.State.Client.State.Ready,
            }),
        );
    }
}
export interface Service extends Interface {}
export const state = register(new Service());
