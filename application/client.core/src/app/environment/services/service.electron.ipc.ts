declare var window: any;

import { guid, Subscription, THandler, Logger } from 'chipmunk.client.toolkit';
import { IPCMessagePackage } from './service.electron.ipc.messagepackage';
import { IService } from '../interfaces/interface.service';
import { IPC } from '../interfaces/interface.ipc';
import { CommonInterfaces } from '../interfaces/interface.common';

export { IPC, Subscription, THandler };

export type TResponseFunc = (message: Required<IPC.Interface>) => Promise<Required<IPC.Interface>>;

interface IPendingTask<T extends IPC.Interface> {
    resolver: (message: T) => any;
    rejector: (error: Error) => void;
    signature: string;
    created: number;
}

class ElectronIpcService implements IService {
    static PENDING_ERR_DURATION: number = 600 * 1000; // 10 mins before report error about pending tasks.
    static PENDING_WARN_DURATION: number = 120 * 1000; // 2 mins before report warn about pending tasks.
    static QUEUE_CHECK_DELAY: number = 5 * 1000;

    private _logger: Logger = new Logger('ElectronIpcService');
    private _subscriptions: Map<string, Subscription> = new Map();
    private _pending: Map<string, IPendingTask<any>> = new Map();
    private _handlers: Map<string, Map<string, THandler>> = new Map();
    private _listeners: Map<string, boolean> = new Map();
    private _ipcRenderer: CommonInterfaces.Electron.IpcRenderer;

    constructor() {
        if ((window as any) === undefined || typeof (window as any).require !== 'function') {
            throw new Error(
                this._logger.error(
                    `"window" object isn't available or "require" function isn't found`,
                ),
            );
        }
        const mod = (window as any).require('electron');
        if (mod === undefined) {
            throw new Error(this._logger.error(`Fail to get access to "electron" module.`));
        }
        this._ipcRenderer = mod.ipcRenderer;
    }
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._report();
            resolve();
        });
    }

    public getName(): string {
        return 'ElectronIpcService';
    }

    public sendToPluginHost(message: any, token: string, stream?: string): void {
        const pluginMessage: IPC.PluginInternalMessage = new IPC.PluginInternalMessage({
            data: message,
            token: token,
            stream: stream,
        });
        this._sendWithoutResponse(pluginMessage);
    }

    public requestToPluginHost(message: any, token: string, stream?: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const pluginMessage: IPC.PluginInternalMessage = new IPC.PluginInternalMessage({
                data: message,
                token: token,
                stream: stream,
            });
            this.request(pluginMessage, IPC.PluginError)
                .then((response: IPC.TMessage | undefined) => {
                    if (
                        !(response instanceof IPC.PluginInternalMessage) &&
                        !(response instanceof IPC.PluginError)
                    ) {
                        return reject(
                            new Error(
                                `From plugin host was gotten incorrect responce: ${typeof response}/${response}`,
                            ),
                        );
                    }
                    if (response instanceof IPC.PluginError) {
                        return reject(response);
                    }
                    resolve(response.data);
                })
                .catch((sendingError: Error) => {
                    reject(sendingError);
                });
        });
    }

    public send(message: Required<IPC.Interface>): Promise<void> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            this._sendWithoutResponse(message);
            resolve(undefined);
        });
    }

    public response(sequence: string, message: Required<IPC.Interface>): Promise<void> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            this._sendWithoutResponse(message, sequence);
            resolve(undefined);
        });
    }

    public request<T extends IPC.Interface>(
        message: Required<IPC.Interface>,
        expected?: Required<IPC.Interface>,
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            this._subscribeIPCMessage(
                expected === undefined ? message.signature : expected.signature,
            );
            this._sendWithResponse<T>({ message: message, sequence: guid() })
                .then(resolve)
                .catch(reject);
        });
    }

    public subscribe(message: Function, handler: THandler): Subscription {
        if (!this._isValidMessageClassRef(message)) {
            throw new Error(this._logger.error('Incorrect reference to message class.', message));
        }
        const signature: string = (message as any).signature;
        return this._setSubscription(signature, handler);
    }

    public subscribeOnPluginMessage(handler: THandler): Promise<Subscription> {
        return new Promise((resolve) => {
            resolve(this._setSubscription(IPC.PluginInternalMessage.signature, handler));
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
            this._subscribeIPCMessage(signature);
        }
        handlers.set(subscriptionId, handler);
        this._handlers.set(signature, handlers);
        const subscription: Subscription = new Subscription(
            signature,
            () => {
                this._unsubscribe(signature, subscriptionId);
            },
            subscriptionId,
        );
        this._subscriptions.set(subscriptionId, subscription);
        return subscription;
    }

    private _emitIncomePluginMessage(message: any) {
        const handlers: Map<string, THandler> | undefined = this._handlers.get(
            IPC.PluginInternalMessage.signature,
        );
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
        this._ipcRenderer.on(messageAlias, this._onIPCMessage.bind(this));
        return true;
    }

    private _onIPCMessage(ipcEvent: Event, eventName: string, data: any) {
        const messagePackage: IPCMessagePackage = new IPCMessagePackage(data);
        const pending: IPendingTask<any> | undefined = this._pending.get(messagePackage.sequence);
        this._pending.delete(messagePackage.sequence);
        const refMessageClass = this._getRefToMessageClass(messagePackage.message);
        if (refMessageClass === undefined) {
            return this._logger.warn(
                `Cannot find ref to class of message. Event: ${eventName}; data: ${data}.`,
            );
        }
        const instance: IPC.TMessage = new (refMessageClass as any)(messagePackage.message);
        if (pending !== undefined) {
            return pending.resolver(instance);
        }
        if (instance instanceof IPC.PluginInternalMessage || instance instanceof IPC.PluginError) {
            if (typeof instance.token !== 'string' || instance.token.trim() === '') {
                return this._logger.warn(
                    `Was gotten message "PluginInternalMessage", but message doesn't have token. Message will be ignored.`,
                    instance,
                );
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
    }

    private _sendWithResponse<T extends IPC.Interface>(params: {
        message: Required<IPC.Interface>;
        sequence: string;
    }): Promise<T> {
        return new Promise((resolve, reject) => {
            const messagePackage: IPCMessagePackage = new IPCMessagePackage({
                message: params.message,
                sequence: params.sequence,
            });
            const signature: string = params.message.signature;
            this._pending.set(params.sequence, {
                resolver: resolve,
                rejector: reject,
                signature: signature,
                created: new Date().getTime(),
            });
            // Format:               | channel  |  event  | instance |
            this._ipcRenderer.send(signature, signature, messagePackage);
        });
    }

    private _sendWithoutResponse(message: Required<IPC.Interface>, sequence?: string): void {
        const messagePackage: IPCMessagePackage = new IPCMessagePackage({
            message: message,
            sequence: sequence,
        });
        const signature: string = message.signature;
        // Format:               | channel  |  event  | instance |
        this._ipcRenderer.send(signature, signature, messagePackage);
    }

    private _isValidMessageClassRef(messageRef: Function): boolean {
        let result: boolean = false;
        if (
            typeof (messageRef as any).signature !== 'string' ||
            (messageRef as any).signature.trim() === ''
        ) {
            return false;
        }
        Object.keys(IPC.Map).forEach((alias: string) => {
            if (result) {
                return;
            }
            if ((messageRef as any).signature === (IPC.Map as any)[alias].signature) {
                result = true;
            }
        });
        return result;
    }

    private _getRefToMessageClass(message: any): Function | undefined {
        let ref: Function | undefined;
        Object.keys(IPC.Map).forEach((alias: string) => {
            if (ref) {
                return;
            }
            if (
                message instanceof (IPC.Map as any)[alias] ||
                message.signature === (IPC.Map as any)[alias].signature
            ) {
                ref = (IPC.Map as any)[alias];
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
            this._ipcRenderer.removeAllListeners(signature);
            this._handlers.delete(signature);
            this._listeners.delete(signature);
        } else {
            this._handlers.set(signature, handlers);
        }
    }

    private _report() {
        const current = new Date().getTime();
        this._pending.forEach((task: IPendingTask<any>) => {
            const duration = current - task.created;
            if (duration > ElectronIpcService.PENDING_ERR_DURATION) {
                this._logger.error(
                    `Pending task "${task.signature}" too long stay in queue: ${(
                        duration / 1000
                    ).toFixed(2)}s.`,
                );
            } else if (duration > ElectronIpcService.PENDING_WARN_DURATION) {
                this._logger.warn(
                    `Pending task "${task.signature}" is in a queue for ${(duration / 1000).toFixed(
                        2,
                    )}s.`,
                );
            }
        });
        if (this._pending.size > 0) {
            this._logger.debug(`Pending task queue has ${this._pending.size} tasks.`);
            this._logger.debug(
                `\n\t -${Array.from(this._pending.values())
                    .map((t) => `${t.signature}:: ${t.created}`)
                    .join(`\n\t -`)}`,
            );
        }
        setTimeout(this._report.bind(this), ElectronIpcService.QUEUE_CHECK_DELAY);
    }
}

export default new ElectronIpcService();
