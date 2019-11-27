declare var Electron: any;
import { guid, Subscription, THandler, Logger } from 'chipmunk.client.toolkit';
import * as IPCMessages from '../../../../../common/ipc/electron.ipc.messages/index';
import { IPCMessagePackage } from './service.electron.ipc.messagepackage';
import { IService } from '../interfaces/interface.service';
export { IPCMessages, Subscription, THandler };

export type TResponseFunc = (message: IPCMessages.TMessage) => Promise<IPCMessages.TMessage | undefined>;

class ElectronIpcService implements IService {

    private _logger: Logger = new Logger('ElectronIpcService');
    private _subscriptions: Map<string, Subscription> = new Map();
    private _pending: Map<string, (message: IPCMessages.TMessage) => any> = new Map();
    private _handlers: Map<string, Map<string, THandler>> = new Map();
    private _listeners: Map<string, boolean> = new Map();

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    public getName(): string {
        return 'ElectronIpcService';
    }

    public sendToPluginHost(message: any, token: string, stream?: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const pluginMessage: IPCMessages.PluginInternalMessage = new IPCMessages.PluginInternalMessage({
                data: message,
                token: token,
                stream: stream
            });
            this._send({ message: pluginMessage }).then(() => {
                resolve();
            }).catch((sendingError: Error) => {
                reject(sendingError);
            });
        });
    }

    public requestToPluginHost(message: any, token: string, stream?: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const pluginMessage: IPCMessages.PluginInternalMessage = new IPCMessages.PluginInternalMessage({
                data: message,
                token: token,
                stream: stream
            });
            this.request(pluginMessage, IPCMessages.PluginError).then((response: IPCMessages.TMessage | undefined) => {
                if (!(response instanceof IPCMessages.PluginInternalMessage) && !(response instanceof IPCMessages.PluginError)) {
                    return reject(new Error(`From plugin host was gotten incorrect responce: ${typeof response}/${response}`));
                }
                if (response instanceof IPCMessages.PluginError) {
                    return reject(response);
                }
                resolve(response.data);
            }).catch((sendingError: Error) => {
                reject(sendingError);
            });
        });
    }

    public send(message: IPCMessages.TMessage): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            this._send({ message: message }).then(() => {
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
            this._send({ message: message, sequence: sequence }).then(() => {
                resolve();
            }).catch((sendingError: Error) => {
                reject(sendingError);
            });
        });
    }

    public request(message: IPCMessages.TMessage, expected?: any): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            this._subscribeIPCMessage(expected === undefined ? message.signature : expected.signature);
            this._send({ message: message, expectResponse: true, sequence: guid() }).then((response: IPCMessages.TMessage | undefined) => {
                resolve(response);
            }).catch((sendingError: Error) => {
                reject(sendingError);
            });
        });
    }

    public subscribe(message: Function, handler: THandler): Subscription {
        if (!this._isValidMessageClassRef(message)) {
            throw new Error(this._logger.error('Incorrect reference to message class.', message));
        }
        if (typeof Electron === 'undefined') {
            throw new Error(this._logger.error(`Fail to subscribe to event ${(message as any).signature} because Electron isn't ready.`));
        }
        const signature: string = (message as any).signature;
        return this._setSubscription(signature, handler);
    }

    public subscribeOnPluginMessage(handler: THandler): Promise<Subscription> {
        return new Promise((resolve) => {
            resolve(this._setSubscription(IPCMessages.PluginInternalMessage.signature, handler));
        });
    }

    public destroy() {
        this._subscriptions.forEach((subscription: Subscription) => {
            subscription.destroy();
        });
        this._subscriptions.clear();
    }

    public isAvailable(): boolean {
        return typeof Electron !== 'undefined';
    }

    private _setSubscription(signature: string, handler: THandler): Subscription {
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
        return subscription;
    }

    private _emitIncomePluginMessage(message: any) {
        const handlers: Map<string, THandler> = this._handlers.get(IPCMessages.PluginInternalMessage.signature);
        if (handlers === undefined) {
            return;
        }
        handlers.forEach((handler: THandler) => {
            handler(message);
        });
    }

    private _subscribeIPCMessage(messageAlias: string): boolean {
        if (this._listeners.has(messageAlias)) {
            return false;
        }
        this._listeners.set(messageAlias, true);
        Electron.ipcRenderer.on(messageAlias, this._onIPCMessage.bind(this));
        return true;
    }

    private _onIPCMessage(ipcEvent: Event, eventName: string, data: any) {
        const messagePackage: IPCMessagePackage = new IPCMessagePackage(data);
        const resolver = this._pending.get(messagePackage.sequence);
        this._pending.delete(messagePackage.sequence);
        const refMessageClass = this._getRefToMessageClass(messagePackage.message);
        if (refMessageClass === undefined) {
            return this._logger.warn(`Cannot find ref to class of message. Event: ${eventName}; data: ${data}.`);
        }
        const instance: IPCMessages.TMessage = new (refMessageClass as any)(messagePackage.message);
        if (resolver !== undefined) {
            return resolver(instance);
        }
        if (instance instanceof IPCMessages.PluginInternalMessage || instance instanceof IPCMessages.PluginError) {
            if (typeof instance.token !== 'string' || instance.token.trim() === '') {
                return this._logger.warn(`Was gotten message "PluginInternalMessage", but message doesn't have token. Message will be ignored.`, instance);
            }
            // This is plugin message. Do not pass into common stream of messages
            this._emitIncomePluginMessage(instance);
            return;
        }
        const handlers = this._handlers.get(instance.signature);
        if (handlers === undefined) {
            return;
        }
        // TODO: try / catch should be only on production
        handlers.forEach((handler: THandler) => {
            handler(instance, this.response.bind(this, messagePackage.sequence));
        });
        /*
        try {
        } catch (e) {
            this._logger.warn(`Incorrect format of IPC message: ${typeof data}. Error: ${e.message}`);
        }
        */
    }

    private _send(params: {
        message: IPCMessages.TMessage,
        expectResponse?: boolean,
        sequence?: string
    }): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            if (typeof Electron === 'undefined') {
                return new Error(`Electron is not available.`);
            }
            const messagePackage: IPCMessagePackage = new IPCMessagePackage({
                message: params.message,
                sequence: params.sequence
            });
            const signature: string = params.message.signature;
            if (params.expectResponse) {
                this._pending.set(messagePackage.sequence, resolve);
            }
            // Format:               | channel  |  event  | instance |
            Electron.ipcRenderer.send(signature, signature, messagePackage);
            if (!params.expectResponse) {
                return resolve();
            }
        });
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

    private _unsubscribe(signature: string, subscriptionId: string) {
        this._subscriptions.delete(subscriptionId);
        const handlers: Map<string, THandler> | undefined = this._handlers.get(signature);
        if (handlers === undefined) {
            return;
        }
        handlers.delete(subscriptionId);
        if (handlers.size === 0) {
            typeof Electron !== 'undefined' && Electron.ipcRenderer.removeAllListeners(signature);
            this._handlers.delete(signature);
            this._listeners.delete(signature);
        } else {
            this._handlers.set(signature, handlers);
        }
    }

}

export default (new ElectronIpcService());
