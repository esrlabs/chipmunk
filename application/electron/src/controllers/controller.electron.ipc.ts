import Logger from '../../platform/node/src/env.logger';

import { ipcMain, WebContents } from 'electron';
import { guid, Subscription, THandler } from '../../platform/cross/src/index';

/**
 * @class ControllerElectronIpc
 * @description Provides communication between main and render processes
 */

export default class ControllerElectronIpc {

    private static Events = {
        EventDeclaration: '__eventDeclaration',
    };

    private _logger: Logger = new Logger('ControllerElectronIpc');
    private _contents: WebContents | undefined;
    private _winId: string;
    private _subscriptions: Map<string, Subscription> = new Map();

    constructor(winId: string, contents: WebContents) {
        this._winId = winId;
        this._contents = contents;
    }

    public send(channel: string, ...args: any[]): Error | void {
        if (typeof channel !== 'string' || channel.trim() === '') {
            return new Error(`[Send] Argument "channel" should be a not-empty string. But gotten: ${channel} {${typeof channel}}`);
        }
        if (this._contents === undefined) {
            return new Error(`[Send] Cannot send message, because context on browser's window isn't defined yet.`);
        }
        this._contents.send(channel, ...args);
    }

    public subscribe(channel: string, handler: THandler): Subscription | Error {
        if (typeof channel !== 'string' || channel.trim() === '') {
            return new Error(`[Subscribe] Argument "channel" should be a not-empty string. But gotten: ${channel} {${typeof channel}}`);
        }
        if (typeof handler !== 'function') {
            return new Error(`[Subscribe] Argument "handler" should be a function. But gotten: {${typeof handler}}; channel: ${channel}.`);
        }
        const subscriptionId: string = guid();
        const wrapperHandler = (event: Electron.Event, ...args: any[]) => {
            handler(...args);
        };
        const subscription: Subscription = new Subscription(channel, () => {
            this._contents !== undefined && ipcMain.removeListener(channel as any, wrapperHandler);
            this._subscriptions.delete(subscriptionId);
        }, subscriptionId);
        this._subscriptions.set(subscriptionId, subscription);
        this._contents !== undefined && ipcMain.on(channel as any, wrapperHandler);
        return subscription;
    }

    public destroy() {
        this._subscriptions.forEach((subscription: Subscription) => {
            subscription.destroy();
        });
        this._subscriptions.clear();
    }

}
