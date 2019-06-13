import Subscription from './subscription';
import guid from './tools.guid';

const CSignature = '__subject_handler_guid';

export default class Subject {

    private _handlers: Array<(...args: any[]) => any> = [];
    private _name: string = '';

    constructor(name?: string) {
        if (typeof name === 'string') {
            this._name = name;
        }
    }

    public subscribe(handler: (...args: any[]) => void): Subscription {
        if (typeof handler !== 'function') {
            throw new Error(`Handler of event should be a function.`);
        }
        const id: string = guid();
        (handler as any)[CSignature] = id;
        this._handlers.push(handler);
        return new Subscription(this._name, () => {
            this._unsubscribe(id);
        });
    }

    public destroy(): void {
        this._handlers = [];
    }

    public emit(...args: any[]) {
        this._handlers.forEach((handler: (...args: any[]) => void) => {
            handler(...args);
        });
    }

    private _unsubscribe(id: string) {
        let index: number = -1;
        this._handlers.forEach((handle: any, i: number) => {
            if (index !== -1) {
                return;
            }
            if (handle[CSignature] === id) {
                index = i;
            }
        });
        if (index === -1) {
            return;
        }
        this._handlers.splice(index, 1);
    }

}
