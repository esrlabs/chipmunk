import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { IPCMessagePackage } from './plugin.process.ipc.messagepackage';
import * as IPCMessages from '../../../../common/ipc/plugins.ipc.messages/index';
import ServiceElectron from '../../services/service.electron';
import Logger from '../../tools/env.logger';
import { guid, Subscription, THandler } from '../../tools/index';

export { IPCMessages };

export default class ControllerIPCPlugin extends EventEmitter {

    public static Events = {
    };
    public Events = ControllerIPCPlugin.Events;

    private _logger: Logger;
    private _pluginName: string;
    private _token: string;
    private _process: ChildProcess;
    private _pending: Map<string, (message: IPCMessages.TMessage) => any> = new Map();
    private _subscriptions: Map<string, Subscription> = new Map();
    private _handlers: Map<string, Map<string, THandler>> = new Map();

    constructor(pluginName: string, process: ChildProcess, token: string) {
        super();
        this._pluginName = pluginName;
        this._process = process;
        this._token = token;
        this._logger = new Logger(`plugin IPC: ${this._pluginName}`);
        this._process.on('message', this._onMessage.bind(this));
    }

    /**
     * Sends message to plugin process via IPC without expecting any answer
     * @param {IPCMessages.TMessage} message instance of defined IPC message
     * @param {string} sequence sequence of message (if defined)
     * @returns { Promise<void> }
     */
    public send(message: IPCMessages.TMessage, sequence?: string): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            const messagePackage: IPCMessagePackage = new IPCMessagePackage({
                message: message,
                sequence: sequence,
            });
            this._send(messagePackage).then(() => {
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
            const messagePackage: IPCMessagePackage = new IPCMessagePackage({
                message: message,
                sequence: sequence,
            });
            this._send(messagePackage).then(() => {
                resolve();
            }).catch((sendingError: Error) => {
                reject(sendingError);
            });
        });
    }

    /**
     * Sends message to plugin process via IPC and waiting for an answer
     * @param {IPCMessages.TMessage} message instance of defined IPC message
     * @returns { Promise<IPCMessages.TMessage | undefined> }
     */
    public request(message: IPCMessages.TMessage): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            const ref: Function | undefined = this._getRefToMessageClass(message);
            if (ref === undefined) {
                return reject(new Error(`Incorrect type of message`));
            }
            const messagePackage: IPCMessagePackage = new IPCMessagePackage({
                message: message,
            });
            this._send(messagePackage, true).then((response: IPCMessages.TMessage | undefined) => {
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

    public destroy(): void {
        this._process.removeAllListeners('message');
        this._handlers.clear();
        this._subscriptions.clear();
        this._pending.clear();
    }

    /**
     * Sends message to plugin process via IPC
     * @param {IPCMessagePackage} data package of data
     * @param {boolean} expectResponse  true - promise will be resolved with income message with same "sequence";
     *                                  false (default) - promise will be resolved afte message be sent
     * @returns { Promise<IPCMessagePackage | undefined> }
     */
    private _send(message: IPCMessagePackage, expectResponse: boolean = false): Promise<IPCMessages.TMessage | undefined> {
        return new Promise((resolve, reject) => {
            if (!this._process.send) {
                return reject(new Error(this._logger.error(`IPC isn't available`)));
            }
            if (!(message instanceof IPCMessagePackage)) {
                return reject(new Error(this._logger.error(`Expecting as message instance of IPCMessagePackage`)));
            }
            if (expectResponse) {
                this._pending.set(message.sequence, resolve);
            }
            this._process.send(message, (error: Error) => {
                if (error) {
                    this._logger.warn(`Error while sending message to plugin: ${error.message}`);
                    return reject(error);
                }
                if (!expectResponse) {
                    return resolve();
                }
            });
        });
    }

    /**
     * Handler of incoming message from plugin process
     * @returns void
     */
    private _onMessage(data: any) {
        try {
            const message: IPCMessagePackage = new IPCMessagePackage(data);
            const resolver = this._pending.get(message.sequence);
            this._pending.delete(message.sequence);
            const refMessageClass = this._getRefToMessageClass(message.message);
            if (refMessageClass === undefined) {
                throw new Error(`Cannot find ref to class of message`);
            }
            const instance: IPCMessages.TMessage = new (refMessageClass as any)(message.message);
            if (resolver !== undefined) {
                return resolver(instance);
            } else if (instance instanceof IPCMessages.PluginInternalMessage || instance instanceof IPCMessages.PluginError ) {
                this._redirectToPluginHost(instance, message.sequence);
            } else {
                const handlers = this._handlers.get(instance.signature);
                if (handlers === undefined) {
                    return;
                }
                handlers.forEach((handler: THandler) => {
                    handler(instance, this.response.bind(this, message.sequence));
                });
            }
        } catch (e) {
            this._logger.error(`Incorrect format of IPC message: ${typeof data}. Error: ${e.message}`);
        }
    }

    private _redirectToPluginHost(message: IPCMessages.PluginInternalMessage | IPCMessages.PluginError, sequence?: string) {
        ServiceElectron.redirectIPCMessageToPluginRender(message, sequence);
    }

    private _getRefToMessageClass(message: IPCMessages.TMessage): Function | undefined {
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
            this._handlers.delete(signature);
        } else {
            this._handlers.set(signature, handlers);
        }
    }

}
