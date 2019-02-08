// tslint:disable:ban-types

import Logger from '../../platform/node/src/env.logger';

import { ipcMain, WebContents } from 'electron';
import { guid, Subscription, THandler } from '../../platform/cross/src/index';
import * as IPCMessages from './electron.ipc.messages/index';

export { IPCMessages, Subscription, THandler };

/**
 * @class ControllerElectronIpc
 * @description Provides communication between main and render processes
 */

export default class ControllerElectronIpc {

    private _logger: Logger = new Logger('ControllerElectronIpc');
    private _contents: WebContents | undefined;
    private _winId: string;
    private _subscriptions: Map<string, Subscription> = new Map();

    constructor(winId: string, contents: WebContents) {
        this._winId = winId;
        this._contents = contents;
    }

    public send(event: Function, instance: IPCMessages.TMessage): Error | void {
        if (this._contents === undefined) {
            return new Error(this._logger.warn(`[Send] Cannot send message, because context on browser's window isn't defined yet.`));
        }
        if (typeof event !== 'function' || typeof (event as any).signature !== 'string' || (event as any).signature.trim() === '') {
            return new Error(this._logger.warn(`Incorrect target event definition`));
        }
        const signature: string = (event as any).signature;
        // Get reference to class of message
        const implRef: any = IPCMessages.Map[signature];
        if (implRef === undefined) {
            // Class of event wasn't found
            return new Error(this._logger.warn(`Unknown type of message: ${event}/${typeof event}`));
        }
        if (!(instance instanceof implRef)) {
            return new Error(this._logger.warn(`Target event "${signature}" doesn't match to implementation: ${typeof instance}`));
        }
        // Format:         | channel  |  event  | instance |
        this._contents.send(signature, signature, instance);
    }

    public subscribe(event: Function, handler: (event: IPCMessages.TMessage) => any): Promise<Subscription> {
        return new Promise((resolve, reject) => {
            if (this._contents === undefined) {
                return new Error(this._logger.warn(`[Send] Cannot send message, because context on browser's window isn't defined yet.`));
            }
            if (typeof event !== 'function' || typeof (event as any).signature !== 'string' || (event as any).signature.trim() === '') {
                return reject(new Error(this._logger.warn(`Incorrect target event definition`)));
            }
            const signature: string = (event as any).signature;
            const subscriptionId: string = guid();
            const wrapperHandler = (ipcEvent: Event, eventName: string, eventObj: any) => {
                const impl: IPCMessages.TMessage | Error = this._getEventImpl(eventName, eventObj);
                if (impl instanceof Error) {
                    return this._logger.warn(`Fail to parse income event due error: ${impl.message}. Event: ${eventName}/${typeof eventName}`);
                }
                handler(impl);
            };
            const subscription: Subscription = new Subscription(signature, () => {
                this._contents !== undefined && ipcMain.removeListener(signature, wrapperHandler);
                this._subscriptions.delete(subscriptionId);
            }, subscriptionId);
            this._subscriptions.set(subscriptionId, subscription);
            this._contents !== undefined && ipcMain.on(signature, wrapperHandler);
            resolve(subscription);
        });
    }

    public destroy() {
        this._subscriptions.forEach((subscription: Subscription) => {
            subscription.destroy();
        });
        this._subscriptions.clear();
    }

    private _getEventImpl(event: string, obj: any): IPCMessages.TMessage | Error {
        // Get reference to class of message
        const implRef: any = IPCMessages.Map[event];
        if (implRef === undefined) {
            // Class of event wasn't found
            return new Error(this._logger.warn(`Unknown type of message: ${event}/${typeof event}`));
        }
        // Try to get implementation of message
        try {
            return new implRef(obj);
        } catch (e) {
            return new Error(this._logger.warn(`Fail to implement instance of message "${event}" due error: ${e.message}`));
        }
    }

}
