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
import * as IPCMessages from '../ipc.messages/index';

export { IPCMessages, Subscription, THandler };

class ServiceElectronIpc {

    private _subscriptions: Map<string, Subscription> = new Map();

    public send(event: Function, instance: IPCMessages.TMessage): Error | undefined {
        if (typeof Electron === 'undefined') {
            return new Error(`Electron is not available.`);
        }
        if (typeof event !== 'function' || typeof (event as any).signature !== 'string' || (event as any).signature.trim() === '') {
            return new Error(`Incorrect target event definition`);
        }
        const signature: string = (event as any).signature;
        // Get reference to class of message
        const implRef: any = IPCMessages.Map[signature];
        if (implRef === undefined) {
            // Class of event wasn't found
            return new Error(`Unknown type of message: ${event}/${typeof event}`);
        }
        if (!(instance instanceof implRef)) {
            return new Error(`Target event "${signature}" doesn't match to implementation: ${typeof instance}`);
        }
        // Format:               | channel  |  event  | instance |
        Electron.ipcRenderer.send(signature, signature, instance);
    }

    public subscribe(event: Function, handler: THandler): Promise<Subscription> {
        return new Promise((resolve, reject) => {
            if (typeof Electron === 'undefined') {
                return reject(new Error(`Electron is not available.`));
            }
            if (typeof event !== 'function' || typeof (event as any).signature !== 'string' || (event as any).signature.trim() === '') {
                return reject(new Error(`Incorrect target event definition`));
            }
            const signature: string = (event as any).signature;
            const subscriptionId: string = guid();
            const wrapperHandler = (ipcEvent: Event, eventName: string, eventObj: any) => {
                const impl: IPCMessages.TMessage | Error = this._getEventImpl(eventName, eventObj);
                if (impl instanceof Error) {
                    return console.log(`Fail to parse income event due error: ${impl.message}. Event: ${eventName}/${typeof eventName}`);
                }
                handler(impl);
            };
            const subscription: Subscription = new Subscription(signature, () => {
                Electron.ipcRenderer.removeListener(signature, wrapperHandler);
                this._subscriptions.delete(subscriptionId);
            }, subscriptionId);
            this._subscriptions.set(subscriptionId, subscription);
            Electron.ipcRenderer.on(signature, wrapperHandler);
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
            return new Error(`Unknown type of message: ${event}/${typeof event}`);
        }
        // Try to get implementation of message
        try {
            return new implRef(obj);
        } catch (e) {
            return new Error(`Fail to implement instance of message "${event}" due error: ${e.message}`);
        }
    }
}

export default (new ServiceElectronIpc());
