declare var Electron: any;

import { guid, Subscription, THandler, Logger } from '../tools/index';
import * as IPCMessages from './electron.ipc.messages/index';
import { IPCMessagePackage } from './service.electron.ipc.messagepackage';

export { IPCMessages, Subscription, THandler };

class ServiceElectronIpc {

    private _logger: Logger = new Logger('ServiceElectronIpc');
    private _subscriptions: Map<string, Subscription> = new Map();
    private _pending: Map<string, (message: IPCMessages.TMessage) => any> = new Map();
    private _handlers: Map<string, Map<string, THandler>> = new Map();

    public sendToPluginHost(message: any, token: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const pluginMessage: IPCMessages.PluginMessage = new IPCMessages.PluginMessage({
                message: message,
                token: token,
            });
            this._send({ message: pluginMessage, token: token }).then(() => {
                resolve();
            }).catch((sendingError: Error) => {
                reject(sendingError);
            });
        });
    }

    public requestToPluginHost(message: any, token: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const pluginMessage: IPCMessages.PluginMessage = new IPCMessages.PluginMessage({
                message: message,
                token: token,
            });
            this.request(pluginMessage).then((response: IPCMessages.TMessage | undefined) => {
                if (!(response instanceof IPCMessages.PluginMessage)) {
                    return reject(new Error(`From plugin host was gotten incorrect responce: ${typeof response}/${response}`));
                }
                resolve(response.message);
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

    public request(message: IPCMessages.TMessage): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            this._send({ message: message, expectResponse: true }).then((response: IPCMessages.TMessage | undefined) => {
                resolve(response);
            }).catch((sendingError: Error) => {
                reject(sendingError);
            });
        });
    }

    public subscribe(message: Function, handler: THandler): Promise<Subscription> {
        return new Promise((resolve, reject) => {
            if (typeof Electron === 'undefined') {
                return reject(new Error(`Electron is not available.`));
            }
            if (!this._isValidMessageClassRef(message)) {
                return reject(new Error(`Incorrect reference to message class.`));
            }
            const signature: string = (message as any).signature;
            resolve(this._setSubscription(signature, handler));
        });
    }

    public subscribeOnPluginMessage(handler: THandler): Promise<Subscription> {
        return new Promise((resolve) => {
            resolve(this._setSubscription(IPCMessages.PluginMessage.signature, handler));
        });
    }

    public destroy() {
        this._subscriptions.forEach((subscription: Subscription) => {
            subscription.destroy();
        });
        this._subscriptions.clear();
    }

    private _setSubscription(signature: string, handler: THandler): Subscription {
        const subscriptionId: string = guid();
        let handlers: Map<string, THandler> | undefined = this._handlers.get(signature);
        if (handlers === undefined) {
            handlers = new Map();
            Electron.ipcRenderer.on(signature, this._onIPCMessage.bind(this));
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
        const handlers: Map<string, THandler> = this._handlers.get(IPCMessages.PluginMessage.signature);
        if (handlers === undefined) {
            return;
        }
        handlers.forEach((handler: THandler) => {
            handler(message);
        });
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
                return resolver(instance);
            }
            if (instance instanceof IPCMessages.PluginMessage) {
                if (typeof instance.token !== 'string' || instance.token.trim() === '') {
                    this._logger.warn(`Was gotten message "PluginMessage", but message doesn't have token. Message will be ignored.`, instance);
                    return;
                }
                // This is plugin message. Do not pass into common stream of messages
                this._emitIncomePluginMessage(instance);
                return;
            }
            const handlers = this._handlers.get(instance.signature);
            if (handlers === undefined) {
                return;
            }
            handlers.forEach((handler: THandler) => {
                handler(instance, this.response.bind(this, messagePackage.sequence));
            });
        } catch (e) {
            console.log(`Incorrect format of IPC message: ${typeof data}. Error: ${e.message}`);
        }
    }

    private _send(params: {
        message: IPCMessages.TMessage,
        expectResponse?: boolean,
        sequence?: string,
        token?: string
    }): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            if (typeof Electron === 'undefined') {
                return new Error(`Electron is not available.`);
            }
            const messagePackage: IPCMessagePackage = new IPCMessagePackage({
                message: params.message,
                sequence: params.sequence,
                token: params.token,
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
        } else {
            this._handlers.set(signature, handlers);
        }
    }

}

export default (new ServiceElectronIpc());
