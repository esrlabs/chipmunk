import { Subject } from './subscription';
import { Mutable } from '../types/unity/mutable';
import { unique } from './sequence';

import * as obj from './obj';

export interface ObserverEvent {
    target: any;
    prop: string | symbol;
}

type TRevoke = () => void;

const SIGNATURE = unique();

export class Observer<T> {
    public static sterilize<T>(target: T): T {
        return JSON.parse(JSON.stringify(Observer.clone(target)));
    }

    public static clone<T>(target: T): T {
        if (!obj.isArrayOrObj(target)) {
            return target;
        }
        if (target instanceof Array) {
            return target.map((el) => this.clone(el)) as T;
        } else if (typeof target === 'object') {
            const cloned: any = {};
            Object.keys(target as any).forEach((key: string) => {
                if (key === SIGNATURE) {
                    return;
                }
                cloned[key] = this.clone((target as any)[key]);
            });
            return cloned;
        }
        return target;
    }

    public watcher: Subject<ObserverEvent> = new Subject<ObserverEvent>();
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

    public destroy(): void {
        this.revoke(this.target);
        this.watcher.destroy();
    }

    public sterilize(): T {
        return Observer.sterilize(this.target);
    }

    public overwrite(target: T) {
        this.revoke(this.target);
        (this as Mutable<Observer<T>>).target = this.observe(target);
    }

    protected revoke<T>(target: T): T {
        if (!obj.isArrayOrObj(target)) {
            return target;
        }
        const revoke = (target as any)[SIGNATURE];
        if (typeof revoke === 'function') {
            revoke();
        }
        delete (target as any)[SIGNATURE];
        if (target instanceof Array) {
            target = target.map((el) => this.revoke(el)) as T;
        } else if (typeof target === 'object') {
            Object.keys(target as any).forEach((key: string) => {
                (target as any)[key] = this.revoke((target as any)[key]);
            });
        }
        return target;
    }

    protected observe<T>(target: T): T {
        target = this.revoke(target);
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
        const output = Proxy.revocable(target as any, {
            set: (target, prop, value) => {
                if (prop === SIGNATURE) {
                    target[prop] = value;
                    return true;
                }
                if (target[prop] === value) {
                    return true;
                }
                target[prop] = this.observe(value);
                this.watcher.emit({ target, prop });
                return true;
            },
        });
        (target as any)[SIGNATURE] = output.revoke;
        return output.proxy;
    }
}
