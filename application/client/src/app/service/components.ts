import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { Subjects, Subject } from '@platform/env/subscription';
import {
    LoadingDoneEvent,
    LoadingCancelledEvent,
    LoadingErrorEvent,
    LoadingErrorsEvent,
} from '@platform/types/components';

import * as Events from '@platform/ipc/event/index';
import * as Requests from '@platform/ipc/request/index';

import { Field, FieldDesc, Ident, SourceOrigin } from '@platform/types/bindings';

@SetupService(services['components'])
export class Service extends Implementation {
    public subjects: Subjects<{
        LoadingDone: Subject<LoadingDoneEvent>;
        LoadingErrors: Subject<LoadingErrorsEvent>;
        LoadingError: Subject<LoadingErrorEvent>;
        LoadingCancelled: Subject<LoadingCancelledEvent>;
    }> = new Subjects({
        LoadingDone: new Subject<LoadingDoneEvent>(),
        LoadingErrors: new Subject<LoadingErrorsEvent>(),
        LoadingError: new Subject<LoadingErrorEvent>(),
        LoadingCancelled: new Subject<LoadingCancelledEvent>(),
    });

    public override ready(): Promise<void> {
        this.register(
            Events.IpcEvent.subscribe<Events.Components.LoadingDone.Event>(
                Events.Components.LoadingDone.Event,
                (event) => {
                    this.subjects.get().LoadingDone.emit(event.event);
                },
            ),
            Events.IpcEvent.subscribe<Events.Components.LoadingErrors.Event>(
                Events.Components.LoadingErrors.Event,
                (event) => {
                    this.subjects.get().LoadingErrors.emit(event.event);
                },
            ),
            Events.IpcEvent.subscribe<Events.Components.LoadingError.Event>(
                Events.Components.LoadingError.Event,
                (event) => {
                    this.subjects.get().LoadingError.emit(event.event);
                },
            ),
            Events.IpcEvent.subscribe<Events.Components.LoadingCancelled.Event>(
                Events.Components.LoadingCancelled.Event,
                (event) => {
                    this.subjects.get().LoadingCancelled.emit(event.event);
                },
            ),
        );
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.unsubscribe();
        return Promise.resolve();
    }

    public abort(fields: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Components.Abort.Response,
                new Requests.Components.Abort.Request({
                    fields,
                }),
            )
                .then((_) => {
                    resolve();
                })
                .catch(reject);
        });
    }

    public getOptions(origin: SourceOrigin, targets: string[]): Promise<Map<string, FieldDesc[]>> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Components.GetOptions.Response,
                new Requests.Components.GetOptions.Request({
                    origin,
                    targets,
                }),
            )
                .then((response) => {
                    resolve(response.options);
                })
                .catch(reject);
        });
    }

    public validate(
        origin: SourceOrigin,
        target: string,
        fields: Field[],
    ): Promise<Map<string, string>> {
        return new Promise((resolve, reject) => {
            Requests.IpcRequest.send(
                Requests.Components.Validate.Response,
                new Requests.Components.Validate.Request({
                    origin,
                    target,
                    fields,
                }),
            )
                .then((response) => {
                    resolve(response.errors);
                })
                .catch(reject);
        });
    }
    public get(origin: SourceOrigin): {
        sources(): Promise<Ident[]>;
        parsers(): Promise<Ident[]>;
    } {
        return {
            sources: (): Promise<Ident[]> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Components.GetSources.Response,
                        new Requests.Components.GetSources.Request({
                            origin,
                        }),
                    )
                        .then((response) => {
                            resolve(response.list);
                        })
                        .catch(reject);
                });
            },
            parsers: (): Promise<Ident[]> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Components.GetParsers.Response,
                        new Requests.Components.GetParsers.Request({
                            origin,
                        }),
                    )
                        .then((response) => {
                            resolve(response.list);
                        })
                        .catch(reject);
                });
            },
        };
    }
}
export interface Service extends Interface {}
export const components = register(new Service());
