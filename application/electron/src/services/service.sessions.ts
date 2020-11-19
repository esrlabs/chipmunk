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

import { IPCMessages as IPCElectronMessages, Subscription } from './service.electron';
import { EventsHub } from '../controllers/stream.common/events';
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
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _subjects: IServiceSubjects = {
        changed: new Tools.Subject('changed'),
        destroyed: new Tools.Subject('destroyed'),
        inited: new Tools.Subject('inited'),
    };

    constructor() {
        // Binding
        this._ipc_onStreamSetActive = this._ipc_onStreamSetActive.bind(this);
        this._ipc_onStreamAdd = this._ipc_onStreamAdd.bind(this);
        this._ipc_onStreamRemoveRequest = this._ipc_onStreamRemoveRequest.bind(this);
    }

    /**
     * Initialization function
     * @returns Promise<void>
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            Promise.all([
                ServiceElectron.IPC.subscribe(IPCElectronMessages.StreamAddRequest, this._ipc_onStreamAdd).then((subscription: Subscription) => {
                    this._subscriptions.streamAdd = subscription;
                }).catch((error: Error) => {
                    return Promise.reject(new Error(this._logger.warn(`Fail to subscribe to render event "StreamAddRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`)));
                }),
                ServiceElectron.IPC.subscribe(IPCElectronMessages.StreamRemoveRequest, this._ipc_onStreamRemoveRequest).then((subscription: Subscription) => {
                    this._subscriptions.StreamRemoveRequest = subscription;
                }).catch((error: Error) => {
                    return Promise.reject(new Error(this._logger.warn(`Fail to subscribe to render event "StreamRemove" due error: ${error.message}. This is not blocked error, loading will be continued.`)));
                }),
                ServiceElectron.IPC.subscribe(IPCElectronMessages.StreamSetActive, this._ipc_onStreamSetActive).then((subscription: Subscription) => {
                    this._subscriptions.StreamSetActive = subscription;
                }).catch((error: Error) => {
                    return Promise.reject(new Error(this._logger.warn(`Fail to subscribe to render event "StreamSetActive" due error: ${error.message}. This is not blocked error, loading will be continued.`)));
                })
            ]).then(() =>{
                resolve();
            }).catch(reject);
        });
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
                this._sessions.set(guid, controller);
                resolve(controller);
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


    private _ipc_onStreamAdd(message: IPCElectronMessages.TMessage, response: (res: IPCElectronMessages.TMessage) => any) {
        if (!(message instanceof IPCElectronMessages.StreamAddRequest)) {
            return;
        }
        // Create stream
        this._create().then((controller: ControllerSession) => {
            // Check active
            if (this._session === undefined) {
                this._session = controller;
            }
            // Response
            response(new IPCElectronMessages.StreamAddResponse({
                guid: controller.get().UUID(),
            }));
        }).catch((streamCreateError: Error) => {
            const errMsg: string = `Fail to create stream due error: ${streamCreateError.message}`;
            // Response
            response(new IPCElectronMessages.StreamAddResponse({
                guid: '',
                error: errMsg,
            }));
            this._logger.error(errMsg);
        });
    }

    private _ipc_onStreamRemoveRequest(message: IPCElectronMessages.TMessage, response: (message: IPCElectronMessages.TMessage) => void) {
        if (!(message instanceof IPCElectronMessages.StreamRemoveRequest)) {
            return;
        }
        this._destroy(message.guid).then(() => {
            response(new IPCElectronMessages.StreamRemoveResponse({ guid: message.guid }));
        }).catch((destroyError: Error) => {
            this._logger.error(`Fail to correctly destroy session "${message.guid}" due error: ${destroyError.message}.`);
            response(new IPCElectronMessages.StreamRemoveResponse({ guid: message.guid, error: destroyError.message }));
        });
    }

    private _ipc_onStreamSetActive(message: IPCElectronMessages.TMessage) {
        if (!(message instanceof IPCElectronMessages.StreamSetActive)) {
            return;
        }
        if (this._session !== undefined && this._session.get().UUID() === message.guid) {
            return;
        }
        const controller: ControllerSession | undefined = this._sessions.get(message.guid);
        if (controller === undefined) {
            return this._logger.warn(`Fail to set active session "${message.guid}". Session hasn't been found.`);
        }
        this._session = controller;
        this._subjects.changed.emit(controller);
        this._logger.debug(`Active session is set to: ${this._session.get().UUID()}`);
    }

}

export default (new ServiceSessions());
