import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { ilc, Emitter, Declarations } from '@service/ilc';

import * as Events from '@platform/ipc/event/index';

export interface States {
    ui: {
        input: boolean;
    };
}

@SetupService(services['state'])
export class Service extends Implementation {
    private _emitter!: Emitter;
    private _states: States = {
        ui: {
            input: false,
        },
    };

    public override ready(): Promise<void> {
        this._emitter = ilc.emitter(this.getName(), this.log());
        const channel = ilc.channel(this.getName(), this.log());
        this.register(
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
        channel.ui.input.focused(() => {
            this._states.ui.input = true;
        });
        channel.ui.input.blur(() => {
            this._states.ui.input = false;
        });
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.unsubscribe();
        return Promise.resolve();
    }

    public setClientAsReady() {
        Events.IpcEvent.emit(
            new Events.State.Client.Event({
                state: Events.State.Client.State.Ready,
            }),
        );
    }

    public states(): States {
        return this._states;
    }
}
export interface Service extends Interface {}
export const state = register(new Service());
