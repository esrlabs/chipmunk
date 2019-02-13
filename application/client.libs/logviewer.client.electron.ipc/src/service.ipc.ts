declare var Electron: any;

import { guid, Subscription, THandler } from '../platform/cross/src/index';
import * as IPCMessages from './ipc.messages/index';
import { IPCMessagePackage } from './service.ipc.messagepackage';
export { IPCMessages, Subscription, THandler };

class ServiceElectronIpc {

    private _subscriptions: Map<string, Subscription> = new Map();
    private _pending: Map<string, (message: IPCMessages.TMessage) => any> = new Map();
    private _handlers: Map<string, Map<string, THandler>> = new Map();

    public send(message: IPCMessages.TMessage): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            this._send(message).then(() => {
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

    public request(message: IPCMessages.TMessage): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            this._send(message, true).then((response: IPCMessages.TMessage | undefined) => {
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
            resolve(subscription);
        });
    }

    public destroy() {
        this._subscriptions.forEach((subscription: Subscription) => {
            subscription.destroy();
        });
        this._subscriptions.clear();
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

    private _send(message: IPCMessages.TMessage, expectResponse: boolean = false, sequence?: string): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            if (typeof Electron === 'undefined') {
                return new Error(`Electron is not available.`);
            }
            const messagePackage: IPCMessagePackage = new IPCMessagePackage({
                message: message,
                sequence: sequence,
            });
            const signature: string = message.signature;
            if (expectResponse) {
                this._pending.set(messagePackage.sequence, resolve);
            }
            // Format:               | channel  |  event  | instance |
            Electron.ipcRenderer.send(signature, signature, messagePackage);
            if (!expectResponse) {
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
