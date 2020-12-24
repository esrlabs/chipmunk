// tslint:disable: member-ordering

import * as Path from 'path';
import * as fs from 'fs';
import * as Net from 'net';
import * as FS from '../tools/fs';
import * as Stream from 'stream';
import * as Tools from '../tools/index';

import ServicePaths from './service.paths';
import ServicePlugins from './service.plugins';
import ServiceElectron from './service.electron';
import Logger from '../tools/env.logger';

import { IPCMessages as IPC, Subscription } from './service.electron';
import { IService } from '../interfaces/interface.service';
import { ControllerSession } from '../controllers/stream.main/controller';

export interface IServiceSubjects {
    changed: Tools.Subject<ControllerSession>;
    destroyed: Tools.Subject<string>;
    inited: Tools.Subject<ControllerSession>;
}

type TGuid = string;

/**
 * @class ServiceSessions
 * @description Controlls data streams of application
 */

class ServiceSessions implements IService  {

    private _logger: Logger = new Logger('ServiceSessions');
    private _sessions: Map<TGuid, ControllerSession> = new Map();
    private _session: ControllerSession | undefined;
    private readonly _subscriptions: {
        ipc: { [key: string]: Subscription };
    } = {
        ipc: {},
    };
    private _subjects: IServiceSubjects = {
        changed: new Tools.Subject('changed'),
        destroyed: new Tools.Subject('destroyed'),
        inited: new Tools.Subject('inited'),
    };

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return this._ipc().subscribe();
    }

    public getName(): string {
        return 'ServiceSessions';
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            // Unsubscribe IPC messages / events
            Object.keys(this._subscriptions).forEach((key: string) => {
                (this._subscriptions as any)[key].destroy();
            });
            // Destroy all controllers
            Promise.all(Array.from(this._sessions.values()).map((controller: ControllerSession) => {
                return controller.destroy().catch((err: Error) => {
                    this._logger.warn(`Fail to correctly destroy session ${controller.get().UUID()} due error: ${err.message}`);
                });
            })).catch((err: Error) => {
                this._logger.error(`Error on ServiceSessions destroy: ${err.message}`);
            }).finally(() => {
                // Unsubscribe all session events
                Object.keys(this._subjects).forEach((key: string) => {
                    (this._subjects as any)[key].destroy();
                });
                resolve();
            });
        });
    }

    public getSubjects(): IServiceSubjects {
        return this._subjects;
    }

    public getActiveSessionUUID(): string | undefined {
        return this._session !== undefined ? this._session.get().UUID() : undefined;
    }

    public getActiveSession(): ControllerSession | undefined {
        return this._session !== undefined ? this._session : undefined;
    }

/*
    public add(): Promise<ControllerSession> {
        return new Promise((resolve, reject) => {
            ServiceElectron.IPC.request(new IPC.RenderSessionAddRequest(), IPC.RenderSessionAddResponse).then((response: IPC.RenderSessionAddResponse) => {
                if (response.error !== undefined) {
                    this._logger.warn(`Fail to add new session due error: ${response.error}`);
                    return reject(new Error(response.error));
                }
                resolve();
            }).catch((err: Error) => {
                this._logger.warn(`Fail to add new session due error: ${err.message}`);
                reject(err);
            });
        });
    }
*/
    /**
     * Creates new session instance
     * @returns Promise<ControllerSession>
     */
    private _create(): Promise<ControllerSession> {
        return new Promise((resolve, reject) => {
            const controller: ControllerSession = new ControllerSession();
            controller.getSubjects().inited.subscribe((cntr: ControllerSession) => {
                this._subjects.inited.emit(cntr);
            });
            controller.getSubjects().destroyed.subscribe((uuid: string) => {
                this._subjects.destroyed.emit(uuid);
            });
            controller.init().then((guid: string) => {
                ServicePlugins.addStream(controller).catch((err: Error) => {
                    this._logger.warn(`Fail correctly pass session to plugins due error: ${err.message}`);
                }).finally(() => {
                    this._sessions.set(guid, controller);
                    resolve(controller);
                });
            }).catch((err: Error) => {
                this._logger.error(`Fail to create session controller due error: ${err.message}`);
                reject(err);
            });
        });
    }

    /**
     * Destroy session instance
     * @returns Promise<void>
     */
    private _destroy(uuid: string): Promise<void> {
        return new Promise((resolve) => {
            const controller: ControllerSession | undefined = this._sessions.get(uuid);
            if (controller === undefined) {
                this._logger.warn(`Fail to remove session "${uuid}. No such session has been found.`);
                return resolve();
            }
            controller.destroy().catch((err: Error) => {
                this._logger.error(`Fail to correctly remove session "${uuid} due error: ${err.message}`);
            }).finally(() => {
                this._sessions.delete(uuid);
                resolve();
            });
        });
    }

    private _ipc(): {
        subscribe(): Promise<void>;
        unsubscribe(): void;
        handlers: {
            add(message: IPC.StreamAddRequest, response: (res: IPC.TMessage) => any): void;
            remove(message: IPC.StreamRemoveRequest, response: (res: IPC.TMessage) => any): void;
            activate(message: IPC.StreamSetActive, response: (res: IPC.TMessage) => any): void;
        };
    } {
        const self = this;
        return {
            subscribe(): Promise<void> {
                return Promise.all([
                    ServiceElectron.IPC.subscribe(IPC.StreamAddRequest, self._ipc().handlers.add as any).then((subscription: Subscription) => {
                        self._subscriptions.ipc.add = subscription;
                    }).catch((error: Error) => {
                        return Promise.reject(new Error(self._logger.warn(`Fail to subscribe to render event "StreamAddRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`)));
                    }),
                    ServiceElectron.IPC.subscribe(IPC.StreamRemoveRequest, self._ipc().handlers.remove as any).then((subscription: Subscription) => {
                        self._subscriptions.ipc.remove = subscription;
                    }).catch((error: Error) => {
                        return Promise.reject(new Error(self._logger.warn(`Fail to subscribe to render event "StreamRemove" due error: ${error.message}. This is not blocked error, loading will be continued.`)));
                    }),
                    ServiceElectron.IPC.subscribe(IPC.StreamSetActive, self._ipc().handlers.activate as any).then((subscription: Subscription) => {
                        self._subscriptions.ipc.activate = subscription;
                    }).catch((error: Error) => {
                        return Promise.reject(new Error(self._logger.warn(`Fail to subscribe to render event "StreamSetActive" due error: ${error.message}. This is not blocked error, loading will be continued.`)));
                    })
                ]).then(() =>{
                    Promise.resolve();
                });
            },
            unsubscribe(): void {
                Object.keys(self._subscriptions.ipc).forEach((key: string) => {
                    self._subscriptions.ipc[key].destroy();
                });
            },
            handlers: {
                add(message: IPC.StreamAddRequest, response: (res: IPC.TMessage) => any): void {
                    // Create stream
                    self._create().then((controller: ControllerSession) => {
                        // Check active
                        if (self._session === undefined) {
                            self._session = controller;
                        }
                        // Response
                        response(new IPC.StreamAddResponse({
                            guid: controller.get().UUID(),
                        }));
                    }).catch((streamCreateError: Error) => {
                        const errMsg: string = `Fail to create stream due error: ${streamCreateError.message}`;
                        // Response
                        response(new IPC.StreamAddResponse({
                            guid: '',
                            error: errMsg,
                        }));
                        self._logger.error(errMsg);
                    });
                },
                remove(message: IPC.StreamRemoveRequest, response: (res: IPC.TMessage) => any): void {
                    self._destroy(message.guid).then(() => {
                        response(new IPC.StreamRemoveResponse({ guid: message.guid }));
                    }).catch((destroyError: Error) => {
                        self._logger.error(`Fail to correctly destroy session "${message.guid}" due error: ${destroyError.message}.`);
                        response(new IPC.StreamRemoveResponse({ guid: message.guid, error: destroyError.message }));
                    });
                },
                activate(message: IPC.StreamSetActive, response: (res: IPC.TMessage) => any): void {
                    if (self._session !== undefined && self._session.get().UUID() === message.guid) {
                        return;
                    }
                    const controller: ControllerSession | undefined = self._sessions.get(message.guid);
                    if (controller === undefined) {
                        self._logger.warn(`Fail to set active session "${message.guid}". Session hasn't been found.`);
                        return;
                    }
                    self._session = controller;
                    self._subjects.changed.emit(controller);
                    self._logger.debug(`Active session is set to: ${self._session.get().UUID()}`);
                }
            },
        };
    }

}

export default (new ServiceSessions());
