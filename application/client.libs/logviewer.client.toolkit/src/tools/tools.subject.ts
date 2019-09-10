import Subscription from './tools.subscription';
import guid from './tools.guid';

const CSignature = '__subject_handler_guid';

export default class Subject<T> {

    private _handlers: Array<(value: T) => any> = [];
    private _name: string = '';

    constructor(name?: string) {
        if (typeof name === 'string') {
            this._name = name;
        }
    }

    public subscribe(handler: (value: T) => void): Subscription {
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

    public emit(value: T) {
        this._handlers.forEach((handler: (value: T) => void) => {
            handler(value);
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
