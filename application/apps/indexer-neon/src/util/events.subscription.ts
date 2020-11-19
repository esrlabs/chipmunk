// tslint:disable:variable-name
import uuid from './uuid';

export type THandler = (...args: any[]) => any;

export class Subscription {

    private _unsubsribe: THandler | undefined;
    private _event: string;
    private _subscriptionId: string;

    constructor(event: string, unsubsribe: THandler, subscriptionId?: string) {
        if (typeof unsubsribe !== 'function') {
            throw new Error(`Should be provided unsubsribe function.`);
        }
        if (typeof subscriptionId !== 'string') {
            subscriptionId = uuid();
        }
        this._unsubsribe = unsubsribe;
        this._event = event;
        this._subscriptionId = subscriptionId;
    }

    public getEventName(): string {
        return this._event;
    }

    public getSubscriptionId(): string {
        return this._subscriptionId;
    }

    public unsubscribe(): void {
        if (this._unsubsribe === undefined) {
            return;
        }
        this._unsubsribe();
    }

    public destroy(): void {
        this.unsubscribe();
        this._unsubsribe = undefined;
    }

}
