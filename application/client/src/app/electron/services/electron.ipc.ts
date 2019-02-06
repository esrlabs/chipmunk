/*
const { ipcRenderer } = require('electron')
console.log(ipcRenderer.sendSync('synchronous-message', 'ping')) // prints "pong"

ipcRenderer.on('asynchronous-reply', (event, arg) => {
  console.log(arg) // prints "pong"
})
ipcRenderer.send('asynchronous-message', 'ping')
*/

declare var Electron;

import { guid, Subscription, THandler } from '../../../../platform/cross/src/index';

class ServiceElectronIpc {

    private _subscriptions: Map<string, Subscription> = new Map();

    public send(event: string, ...args: any[]): void {
        Electron.ipcRenderer.send(event, ...args);
    }

    public subscribe(message: string, handler: THandler): Subscription {
        const subscriptionId: string = guid();
        const wrapperHandler = (event: Event, ...args: any[]) => {
            handler(...args);
        };
        const subscription: Subscription = new Subscription(message, () => {
            Electron.ipcRenderer.removeListener(message, wrapperHandler);
            this._subscriptions.delete(subscriptionId);
        }, subscriptionId);
        this._subscriptions.set(subscriptionId, subscription);
        Electron.ipcRenderer.on(message, wrapperHandler);
        return subscription;
    }

    public destroy() {
        this._subscriptions.forEach((subscription: Subscription) => {
            subscription.destroy();
        });
        this._subscriptions.clear();
    }
}

export default (new ServiceElectronIpc());
