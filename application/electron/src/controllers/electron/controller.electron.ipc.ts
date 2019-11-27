// tslint:disable:ban-types

import Logger from '../../tools/env.logger';

import { ipcMain, WebContents } from 'electron';
import { guid, Subscription, THandler } from '../../tools/index';
import * as IPCMessages from '../../../../common/ipc/electron.ipc.messages/index';
import { IPCMessagePackage } from './controller.electron.ipc.messagepackage';
import ServicePlugins from '../../services/service.plugins';

export { IPCMessages, Subscription, THandler };

/**
 * @class ControllerElectronIpc
 * @description Provides communication between main and render processes
 */

export default class ControllerElectronIpc {

    private _logger: Logger = new Logger('ControllerElectronIpc');
    private _contents: WebContents | undefined;
    private _winId: string;
    private _pending: Map<string, (message: IPCMessages.TMessage) => any> = new Map();
    private _subscriptions: Map<string, Subscription> = new Map();
    private _handlers: Map<string, Map<string, THandler>> = new Map();
    private _listeners: Map<string, boolean> = new Map();

    constructor(winId: string, contents: WebContents) {
        this._winId = winId;
        this._contents = contents;
        this._redirectToPluginHost = this._redirectToPluginHost.bind(this);
        // Subscribe to plugins messages
        this.subscribe(IPCMessages.PluginInternalMessage, this._redirectToPluginHost);
    }

    public send(message: IPCMessages.TMessage, sequence?: string): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            this._send(message, false, sequence).then(() => {
                resolve();
            }).catch((sendingError: Error) => {
                reject(sendingError);
            });
        });
    }

    public response(sequence: string, message: IPCMessages.TMessage): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            this._send(message, false, sequence).then(() => {
                resolve();
            }).catch((sendingError: Error) => {
                reject(sendingError);
            });
        });
    }

    public request(message: IPCMessages.TMessage, expected?: IPCMessages.TMessage): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            if (expected) {
                const expectedRef: Function | undefined = this._getRefToMessageClass(expected);
                if (expectedRef === undefined) {
                    return reject(new Error(`Incorrect type of expected message`));
                }
                // Subscribe to expected message if needed
                this._subscribeIPCMessage(expected.signature);
            }
            this._send(message, true, undefined).then((response: IPCMessages.TMessage | undefined) => {
                resolve(response);
            }).catch((sendingError: Error) => {
                reject(sendingError);
            });
        });
    }

    public subscribe(message: Function, handler: THandler): Promise<Subscription> {
        return new Promise((resolve, reject) => {
            if (!this._isValidMessageClassRef(message)) {
                return reject(new Error(`Incorrect reference to message class.`));
            }
            const signature: string = (message as any).signature;
            const subscriptionId: string = guid();
            let handlers: Map<string, THandler> | undefined = this._handlers.get(signature);
            if (handlers === undefined) {
                handlers = new Map();
                this._subscribeIPCMessage(signature);
            }
            handlers.set(subscriptionId, handler);
            this._handlers.set(signature, handlers);
            const subscription: Subscription = new Subscription(signature, () => {
                this._unsubscribe(signature, subscriptionId);
            }, subscriptionId);
            this._subscriptions.set(subscriptionId, subscription);
            resolve(subscription);
        });
    }

    public destroy() {
        this._handlers.forEach((handlers: Map<string, THandler>, signature: string) => {
            if (this._contents !== undefined) {
                ipcMain.removeAllListeners(signature);
            }
        });
        this._handlers.clear();
        this._subscriptions.clear();
        this._pending.clear();
        this._listeners.clear();
    }

    private _subscribeIPCMessage(messageAlias: string): boolean {
        if (this._listeners.has(messageAlias)) {
            return false;
        }
        if (this._contents === undefined) {
            return false;
        }
        this._listeners.set(messageAlias, true);
        ipcMain.on(messageAlias, this._onIPCMessage.bind(this));
        return true;
    }

    private _onIPCMessage(ipcEvent: Event, eventName: string, data: any) {
        try {
            const messagePackage: IPCMessagePackage = new IPCMessagePackage(data);
            const resolver = this._pending.get(messagePackage.sequence);
            this._pending.delete(messagePackage.sequence);
            const refMessageClass = this._getRefToMessageClass(messagePackage.message);
            if (refMessageClass === undefined) {
                throw new Error(`Cannot find ref to class of message`);
            }
            const instance: IPCMessages.TMessage = new (refMessageClass as any)(messagePackage.message);
            if (resolver !== undefined) {
                resolver(instance);
            } else {
                const handlers = this._handlers.get(instance.signature);
                if (handlers === undefined) {
                    return;
                }
                handlers.forEach((handler: THandler) => {
                    handler(instance, this.response.bind(this, messagePackage.sequence), messagePackage.sequence);
                });
            }
        } catch (e) {
            this._logger.error(`Incorrect format of IPC message: ${typeof data}. Error: ${e.message}`);
        }
    }

    private _redirectToPluginHost(message: IPCMessages.PluginInternalMessage, response: () => any, sequence?: string) {
        ServicePlugins.redirectIPCMessageToPluginHost(message, sequence);
    }

    private _send(message: IPCMessages.TMessage, expectResponse: boolean = false, sequence?: string): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            if (this._contents === undefined) {
                return new Error(this._logger.warn(`[Send] Cannot send message, because context on browser's window isn't defined yet.`));
            }
            const messagePackage: IPCMessagePackage = new IPCMessagePackage({
                message: message,
                sequence: sequence,
            });
            const signature: string = message.signature;
            if (expectResponse) {
                this._pending.set(messagePackage.sequence, resolve);
            }
            // Format:         | channel  |  event  | instance |
            this._contents.send(signature, signature, messagePackage.serialize());
            if (!expectResponse) {
                return resolve();
            }
        });
    }

    private _getRefToMessageClass(message: any): Function | undefined {
        let ref: Function | undefined;
        Object.keys(IPCMessages.Map).forEach((alias: string) => {
            if (ref) {
                return;
            }
            if (message instanceof (IPCMessages.Map as any)[alias] || message.signature === (IPCMessages.Map as any)[alias].signature) {
                ref = (IPCMessages.Map as any)[alias];
            }
        });
        return ref;
    }

    private _isValidMessageClassRef(messageRef: Function): boolean {
        let result: boolean = false;
        if (typeof (messageRef as any).signature !== 'string' || (messageRef as any).signature.trim() === '') {
            return false;
        }
        Object.keys(IPCMessages.Map).forEach((alias: string) => {
            if (result) {
                return;
            }
            if ((messageRef as any).signature === (IPCMessages.Map as any)[alias].signature) {
                result = true;
            }
        });
        return result;
    }

    private _unsubscribe(signature: string, subscriptionId: string) {
        this._subscriptions.delete(subscriptionId);
        const handlers: Map<string, THandler> | undefined = this._handlers.get(signature);
        if (handlers === undefined) {
            return;
        }
        handlers.delete(subscriptionId);
        if (handlers.size === 0) {
            if (this._contents !== undefined) {
                ipcMain.removeAllListeners(signature);
            }
            this._handlers.delete(signature);
            this._listeners.delete(signature);
        } else {
            this._handlers.set(signature, handlers);
        }
    }

}
