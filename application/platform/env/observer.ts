import { Subject } from './subscription';
import { unique } from './sequence';

import * as obj from './obj';

export class Observer<T> {
    protected readonly signature: string = unique();

    public watcher: Subject<{ target: any; prop: string | symbol }> = new Subject<{
        target: any;
        prop: string | symbol;
    }>();
    public readonly target: T;

    constructor(target: T) {
        if (typeof target !== 'object' && !(target instanceof Array)) {
            throw new Error(`Only objects and arrays can be observed`);
        }
        this.target = this.observe(target);
    }

    public get(): T {
        return this.target;
    }

    protected observe<T>(target: T): T {
        if (!obj.isArrayOrObj(target)) {
            return target;
        }
        if (target instanceof Array) {
            target = target.map((el) => this.observe(el)) as T;
        } else if (typeof target === 'object') {
            Object.keys(target as any).forEach((key: string) => {
                (target as any)[key] = this.observe((target as any)[key]);
            });
        }
        Object.defineProperty(target, this.signature, {
            value: true,
            writable: false,
            enumerable: false,
        });
        return new Proxy(target as any, {
            set: (target, prop, value) => {
                if (target[prop] === value) {
                    return true;
                }
                if (prop === this.signature) {
                    target[prop] = value;
                    return true;
                }
                target[prop] = this.observe(value);
                this.watcher.emit({ target, prop });
                return true;
            },
        }) as T;
    }
}
