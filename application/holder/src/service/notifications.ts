import {
    SetupService,
    Interface,
    Implementation,
    register,
    DependOn,
} from 'platform/entity/service';
import { Action } from 'platform/types/notification/index';
import { services } from '@register/services';
import { electron } from '@service/electron';
import { CancelablePromise } from 'platform/env/promise';
import { unique } from 'platform/env/sequence';

import * as Requests from 'platform/ipc/request';
import * as Events from 'platform/ipc/event';

export interface ActionHolder {
    action: Action;
    handler: (args: unknown) => Promise<unknown>;
}

@DependOn(electron)
@SetupService(services['notifications'])
export class Service extends Implementation {
    private _actions: Map<string, ActionHolder[]> = new Map();

    public override ready(): Promise<void> {
        this.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Action.Call.Request,
                    (request: Requests.Action.Call.Request) => {
                        return new CancelablePromise<Requests.Action.Call.Response>((resolve) => {
                            const action = this._getAction(request.uuid);
                            if (action === undefined) {
                                return resolve(
                                    new Requests.Action.Call.Response({
                                        uuid: request.uuid,
                                        output: undefined,
                                        error: `Fail to find handler for action`,
                                    }),
                                );
                            }
                            action
                                .handler(request.inputs)
                                .then((results: unknown) => {
                                    resolve(
                                        new Requests.Action.Call.Response({
                                            uuid: request.uuid,
                                            output: results,
                                            error: undefined,
                                        }),
                                    );
                                })
                                .catch((err: Error) => {
                                    resolve(
                                        new Requests.Action.Call.Response({
                                            uuid: request.uuid,
                                            output: undefined,
                                            error: err.message,
                                        }),
                                    );
                                })
                                .finally(() => {
                                    this._dropGroupByAction(request.uuid);
                                });
                        });
                    },
                ),
        );
        return Promise.resolve();
    }

    public send(
        message: string,
        actions: ActionHolder[],
        session: string | undefined = undefined,
    ): void {
        this._actions.set(unique(), actions);
        Events.IpcEvent.emit(
            new Events.Notification.Pop.Event({
                session,
                message,
                actions: actions.map((a) => a.action),
            }),
        );
    }

    private _getAction(uuid: string): ActionHolder | undefined {
        let action: ActionHolder | undefined;
        this._actions.forEach((group: ActionHolder[]) => {
            if (action !== undefined) {
                return;
            }
            action = group.find((a) => a.action.uuid === uuid);
        });
        return action;
    }

    private _dropGroupByAction(uuid: string): void {
        this._actions.forEach((group: ActionHolder[], groupUuid: string) => {
            if (group.find((a) => a.action.uuid === uuid) !== undefined) {
                this._actions.delete(groupUuid);
            }
        });
    }
}

export interface Service extends Interface {}
export const notifications = register(new Service());
