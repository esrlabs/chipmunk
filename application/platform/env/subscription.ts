import { unique } from './sequence';
import { NormalizedBackgroundTask } from './normalized';

export type THandler = (...args: any[]) => any;

export interface IEventDesc {
    self: any;
    [key: string]: any;
}

const SIGNATURE = '__subject_handler_guid';

export function validateEventDesc(desc: IEventDesc, target: any): Error | undefined {
    const required: string[] = Object.keys(desc).filter((k) => k !== 'self');
    if (desc.self === undefined) {
        return new Error(`Self cannot be undefined`);
    }
    if (desc.self instanceof Array) {
        let valid: boolean = false;
        desc.self.forEach((self) => {
            if (valid) {
                return;
            }
            const cloned = Object.assign({}, desc);
            cloned.self = self;
            valid = validateEventDesc(cloned, target) === undefined;
        });
        return valid
            ? undefined
            : new Error(
                  `Self should be one of [${desc.self.join(', ')}], but not one is suitable.`,
              );
    }
    if (desc.self === null && (target === null || target === undefined)) {
        return undefined;
    }
    if (desc.self === null && target !== null && target !== undefined) {
        return new Error(`Self is defined as null, but target isn't null or undefined`);
    }
    if (desc.self !== null && (target === null || target === undefined)) {
        return new Error(
            `Self isn't null, but event object null or undefined. Required fields: ${required.join(
                ', ',
            )}`,
        );
    }
    if (typeof desc.self !== 'string') {
        if (!(target instanceof desc.self)) {
            return new Error(`Expecting ${desc.self}, but has been gotten ${target}`);
        } else {
            return undefined;
        }
    }
    if (desc.self !== typeof target) {
        return new Error(`Expecting target to be ${desc.self}, but target is ${typeof target}`);
    }
    if (typeof target !== 'object') {
        // It's something like: number, string etc. It's primitive type
        return undefined;
    }
    const errors: string[] = [];
    required.forEach((name: string) => {
        const types: any[] = desc[name] instanceof Array ? desc[name] : [desc[name]];
        let valid: boolean = false;
        types.forEach((typeRef) => {
            if (valid) {
                return;
            }
            if (
                typeof typeRef === 'object' &&
                typeRef !== null &&
                typeof typeRef.self === 'string'
            ) {
                const err: Error | undefined = validateEventDesc(typeRef, target[name]);
                if (err === undefined) {
                    valid = true;
                }
            } else if (
                typeof typeRef === 'string' &&
                (typeof target[name] === typeRef || typeRef === 'any')
            ) {
                valid = true;
            } else if (typeof typeRef !== 'string' && target[name] instanceof typeRef) {
                valid = true;
            }
        });
        if (!valid) {
            errors.push(
                `Expecting property "${name}" has a type "${types
                    .map((t) => {
                        if (typeof t === 'string') {
                            return t;
                        } else if (typeof t === 'object' && t === null) {
                            return `ERROR: null as type definition`;
                        } else if (typeof t === 'object' && typeof t.self === 'string') {
                            return JSON.stringify(t);
                        } else if (typeof t === 'function') {
                            return `${t.name}${
                                t.constructor !== undefined ? `/${t.constructor.name}` : ''
                            }`;
                        } else if (
                            typeof t === 'object' &&
                            t.prototype !== undefined &&
                            t.prototype !== null
                        ) {
                            return `${t.prototype.name}`;
                        } else {
                            return `ERROR: unknown type definition`;
                        }
                    })
                    .join(' | ')}", but it has type "${typeof target[name]}"`,
            );
        }
    });
    if (errors.length !== 0) {
        return new Error(errors.join('\n'));
    }
    return undefined;
}

export class Subject<T> {
    private _handlers: Array<(value: T) => any> = [];
    private _name: string = '';
    private _emitted: boolean = false;
    private _runner: NormalizedBackgroundTask | undefined;

    public static unsubscribe(subjects: unknown): void {
        if (typeof subjects !== 'object' || subjects === null) {
            return;
        }
        Object.keys(subjects as object).forEach((key: string) => {
            const target = (subjects as { [key: string]: Subject<unknown> })[key];
            if (!(target instanceof Subject)) {
                return;
            }
            target.destroy();
        });
    }

    constructor(name?: string) {
        if (typeof name === 'string') {
            this._name = name;
        }
    }

    public balanced(delay: number): Subject<T> {
        this._runner = new NormalizedBackgroundTask(delay);
        return this;
    }

    public subscribe(handler: (value: T) => void): Subscription {
        if (typeof handler !== 'function') {
            throw new Error(`Handler of event should be a function.`);
        }
        const id: string = unique();
        (handler as any)[SIGNATURE] = id;
        this._handlers.push(handler);
        return new Subscription(this._name, () => {
            this._unsubscribe(id);
        });
    }

    public destroy(): void {
        this._handlers = [];
        this._runner !== undefined && this._runner.abort();
    }

    public emit(value: T) {
        const emit = () => {
            this._emitted = true;
            this._handlers.forEach((handler: (value: T) => void) => {
                handler(value);
            });
        };
        if (this._runner !== undefined) {
            this._runner.run(() => {
                emit();
            });
        } else {
            emit();
        }
    }

    public emitted(): boolean {
        return this._emitted;
    }

    public to<C>(): Subject<C> {
        return this as unknown as Subject<C>;
    }

    public isAlone(): boolean {
        return this._handlers.length === 0;
    }

    private _unsubscribe(id: string) {
        let index: number = -1;
        this._handlers.forEach((handle: any, i: number) => {
            if (index !== -1) {
                return;
            }
            if (handle[SIGNATURE] === id) {
                index = i;
            }
        });
        if (index === -1) {
            return;
        }
        this._handlers.splice(index, 1);
    }
}

export class Subjects<T> {
    private readonly _subjects: T & { [key: string]: Subject<any> };

    constructor(subjects: T & { [key: string]: Subject<any> }) {
        this._subjects = subjects;
    }

    public destroy(): void {
        Object.keys(this._subjects).forEach((key: string) => {
            this._subjects[key].destroy();
        });
    }

    public get(): T {
        return this._subjects;
    }
}

export class Subscription {
    private _unsubsribe: THandler | undefined;
    private _event: string;
    private _subscriptionId: string;

    constructor(event: string, unsubsribe: THandler, subscriptionId?: string) {
        if (typeof unsubsribe !== 'function') {
            throw new Error(`Should be provided unsubsribe function.`);
        }
        if (typeof subscriptionId !== 'string') {
            subscriptionId = unique();
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

export interface ISubscription {
    destroy(): void;
    unsubscribe(): void;
}

export class Subscriber {
    private _subscriptions: Map<string, ISubscription> = new Map();
    public register(...subscription: ISubscription[]) {
        subscription.forEach((sub) => {
            this._subscriptions.set(unique(), sub);
        });
    }
    public unsubscribe() {
        this._subscriptions.forEach((subscription) => {
            subscription.unsubscribe();
        });
        this._subscriptions.clear();
    }
}

export interface ListenerTarget {
    addListener(event: string, handler: THandler): void;
    removeListener(event: string, handler: THandler): void;
}

export class Listener {
    protected listening: boolean = false;
    constructor(
        protected readonly event: string,
        protected readonly target: ListenerTarget,
        protected readonly handle: THandler,
    ) {}

    public subscribe() {
        if (this.listening) {
            return;
        }
        this.target.addListener(this.event, this.handle);
        this.listening = true;
    }

    public unsubscribe(): void {
        if (!this.listening) {
            return;
        }
        this.target.removeListener(this.event, this.handle);
        this.listening = false;
    }
}

export class Listeners {
    protected listeners: Listener[] = [];

    public add(event: string, target: ListenerTarget, handle: THandler): void {
        this.listeners.push(new Listener(event, target, handle));
    }

    public push(listener: Listener): void {
        this.listeners.push(listener);
    }

    public subscribe() {
        this.listeners.forEach((l) => l.subscribe());
    }

    public unsubscribe(): void {
        this.listeners.forEach((l) => l.unsubscribe());
    }
}

export function unsubscribeAllInHolder(subjects: unknown): void {
    if (typeof subjects !== 'object' || subjects === null) {
        return;
    }
    Object.keys(subjects as object).forEach((key: string) => {
        const target = (subjects as { [key: string]: Subject<unknown> })[key];
        if (!(target instanceof Subject)) {
            return;
        }
        target.destroy();
    });
}
