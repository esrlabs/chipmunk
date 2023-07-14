import { Subject } from './subscription';
import { Mutable } from '../types/unity/mutable';
import { unique } from './sequence';

import * as obj from './obj';

export interface ObserverEvent {
    target: any;
    prop: string | symbol;
}

type TRevoke = () => void;

export class Observer<T> {
    static REVOKE = '__revoke__';
    static SIGNATURE = `__signature__`;

    static isSame(a: any, b: any): boolean {
        if (!obj.isArrayOrObj(a) && !obj.isArrayOrObj(b)) {
            return a === b;
        }
        if (!obj.isArrayOrObj(a) || !obj.isArrayOrObj(b)) {
            return false;
        }

        if (a instanceof Array && b instanceof Array) {
            if (a.length !== b.length) {
                return false;
            }
            try {
                a.forEach((el, i) => {
                    if (!Observer.isSame(el, b[i])) {
                        throw false;
                    }
                });
            } catch (_) {
                return false;
            }
            return true;
        }
        if (a instanceof Array || b instanceof Array) {
            return false;
        }
        if (typeof a === 'object' && typeof b === 'object') {
            if (Object.keys(a).length !== Object.keys(b).length) {
                return false;
            }
            try {
                Object.keys(a).forEach((key: string) => {
                    if (key === Observer.SIGNATURE || key === Observer.REVOKE) {
                        return;
                    }
                    if (!Observer.isSame(a[key], b[key])) {
                        throw false;
                    }
                });
            } catch (_) {
                return false;
            }
            return true;
        }
        return false;
    }

    public static sterilize<T>(target: T): T {
        return Observer.clone(target);
    }

    public static clone<T>(target: T, map?: Map<string, TRevoke>): T {
        if (!obj.isArrayOrObj(target)) {
            return target;
        }
        if (target instanceof Array) {
            return target.map((el) => this.clone(el, map)) as T;
        } else if (typeof target === 'object') {
            const cloned: any = {};
            Object.keys(target as any).forEach((key: string) => {
                if (key === Observer.SIGNATURE || key === Observer.REVOKE) {
                    map !== undefined && map.delete((target as any)[Observer.SIGNATURE]);
                    return;
                }
                cloned[key] = this.clone((target as any)[key], map);
            });
            return cloned;
        }
        return target;
    }

    protected readonly revoke: Map<string, TRevoke> = new Map();
    protected readonly pending: Map<string, number> = new Map();

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
        this.watcher.destroy();
        this.pending.forEach((id) => clearTimeout(id));
        this.revoke.forEach((revoke) => revoke());
        this.revoke.clear();
        (this as Mutable<Observer<any>>).target = undefined;
    }

    public sterilize(): T {
        return Observer.sterilize(this.target);
    }

    public overwrite(target: T) {
        (this as Mutable<Observer<T>>).target = this.observe(target);
    }

    protected observe<T>(target: T): T {
        if (!obj.isArrayOrObj(target)) {
            return target;
        }
        let cloned: any = Observer.clone(target, this.revoke);
        if (cloned instanceof Array) {
            cloned = cloned.map((el) => this.observe(el)) as T;
        } else if (typeof cloned === 'object') {
            Object.keys(cloned).forEach((key: string) => {
                cloned[key] = this.observe(cloned[key]);
            });
        }
        const output = Proxy.revocable(cloned, {
            set: (target, prop, value) => {
                if (prop === Observer.SIGNATURE || prop === Observer.REVOKE) {
                    target[prop] = value;
                    return true;
                }
                if (target[prop] === value) {
                    return true;
                }
                target[prop] = this.observe(value);
                this.watcher.emit({ target, prop });
                // this.emit({ target, prop });
                return true;
            },
        });
        cloned[Observer.REVOKE] = output.revoke;
        const uuid = unique();
        cloned[Observer.SIGNATURE] = uuid;
        this.revoke.set(uuid, output.revoke);
        return output.proxy;
    }

    protected emit(event: ObserverEvent): void {
        const uuid = unique();
        const id: number = setTimeout(() => {
            this.watcher.emit(event);
            this.pending.delete(uuid);
        }, 0) as unknown as number;
        this.pending.set(uuid, id);
    }
}
