import { error } from '../../log/utils';
import { JsonConvertor } from '../storage/json';
import { Validate, SelfValidate, Alias, Destroy } from '../env/types';
import { List } from './description';
import { Mutable } from '../unity/mutable';
import { scope } from '../../env/scope';
import { Subject, Subscriber } from '../../env/subscription';
import { unique } from '../../env/sequence';

import * as Stream from './origin/stream/index';
import * as File from './types/file';
import * as obj from '../../env/obj';

export interface ConfigurationStatic<T, A> extends Validate<T>, Alias<A> {
    initial(): T;
}

export interface ConfigurationStaticDesc<T, A> extends Validate<T>, Alias<A>, List {
    initial(): T;
}

export interface Reference<T, C, A> extends ConfigurationStatic<T, A> {
    new (...args: any[]): C & Configuration<T, C, A>;
}

export interface ReferenceDesc<T, C, A> extends ConfigurationStaticDesc<T, A> {
    new (...args: any[]): C & Configuration<T, C, A>;
}

const STAMP = '___uuid___';

function setter(subject: Subject<void>, target: any, prop: string | symbol, value: any): boolean {
    if (prop === STAMP && typeof value === 'string') {
        target[prop] = value;
        return true;
    }
    if (obj.isPrimitiveOrNull(value) && target[prop] === value) {
        // No changes: value is same
        return true;
    }
    if (typeof target[prop] === 'object' && typeof value === 'object') {
        if (target[prop][STAMP] !== undefined && target[prop][STAMP] === value[STAMP]) {
            // No changes: value is same
            return true;
        }
    }
    target[prop] = observe(obj.sterilize(value), subject);
    if (typeof target[prop] === 'object') {
        // Set unique uuid of value to avoid dead loop
        // target[prop][STAMP] = unique();
        Object.defineProperty(target[prop], STAMP, {
            value: unique(),
            writable: false,
            enumerable: false,
        });
    }
    subject.emit();
    return true;
}

function observe<T>(entry: T, subject: Subject<void>): T {
    function logger() {
        return scope.getLogger('ObserveConfig');
    }
    if (obj.isPrimitiveOrNull(entry)) {
        return entry;
    }
    if (['function', 'symbol'].includes(typeof entry)) {
        logger().warn(`Cannot observe ${typeof entry} value`);
        return undefined as T;
    }
    if (entry instanceof Array) {
        // We should serialize object, because it can be already Proxy
        return new Proxy(obj.sterilize(entry), { set: setter.bind(null, subject) }) as T;
    } else if (entry instanceof Object) {
        Object.keys(entry).forEach((key: string | number) => {
            // eslint-disable-next-line no-prototype-builtins
            if (!entry.hasOwnProperty(key)) {
                return;
            }
            const value = (entry as any)[key];
            if (obj.isPrimitiveOrNull(value)) {
                return;
            } else if (value instanceof Array || value instanceof Object) {
                (entry as any)[key] = observe(value, subject);
            }
        });
        // We should serialize object, because it can be already Proxy
        return new Proxy(obj.sterilize(entry), { set: setter.bind(null, subject) }) as T;
    }
    logger().error(`Type "${typeof entry}" cannot be observed`);
    return undefined as T;
}

export interface ICompatibilityMod {
    Streams: {
        [key: string]: Stream.Reference[];
    };
    Files: {
        [key: string]: File.FileType[];
    };
    SDESupport: {
        [key: string]: boolean;
    };
    Configurable: {
        [key: string]:
            | {
                  [key: string]: boolean;
              }
            | boolean;
    };
}
// To prevent circle dependency we are loading compatibility table in async way
let compatibility: ICompatibilityMod | undefined;
import('./compatibility')
    .then((mod) => {
        compatibility = mod;
    })
    .catch((err: Error) => {
        scope.getLogger('CompatibilityModule').error(err.message);
    });

export function getCompatibilityMod(): ICompatibilityMod {
    if (compatibility === undefined) {
        throw new Error(`Moudle "compatibility" isn't loaded yet`);
    }
    return compatibility;
}

export abstract class Configuration<T, C, A>
    extends Subscriber
    implements JsonConvertor<Configuration<T, C, A>>, SelfValidate, Destroy
{
    protected ref: Reference<T, C, A>;
    protected overwriting: boolean = false;

    public readonly configuration: T;
    public readonly watcher: Subject<void> = new Subject();
    protected readonly __uuid: string = unique();

    constructor(configuration: T) {
        super();
        if (typeof this.constructor !== 'function') {
            throw new Error(`Fail to get reference to Constructor`);
        }
        this.ref = this.constructor as Reference<T, C, A>;
        this.configuration = observe<T>(configuration, this.watcher);
    }

    public destroy(): void {
        this.watcher.destroy();
        this.unsubscribe();
        (this as any).configuration = this.sterilized();
    }

    public overwrite(configuration: T): void {
        if (this.overwriting) {
            return;
        }
        this.overwriting = true;
        (this as Mutable<Configuration<unknown, unknown, unknown>>).configuration = observe<T>(
            configuration,
            this.watcher,
        );
        this.overwriting = false;
    }

    public validate(): Error | undefined {
        const error: Error | T = this.ref.validate(this.configuration);
        return error instanceof Error ? error : undefined;
    }

    public alias(): A {
        return this.ref.alias();
    }

    public json(): {
        to(): string;
        from(str: string): Configuration<T, C, A> | Error;
    } {
        return {
            to: (): string => {
                return obj.sterilize(JSON.stringify(this.configuration), [STAMP]);
            },
            from: (str: string): Configuration<T, C, A> | Error => {
                try {
                    const configuration: T | Error = this.ref.validate(JSON.parse(str));
                    if (configuration instanceof Error) {
                        return configuration;
                    }
                    this.overwrite(configuration);
                    return this;
                } catch (e) {
                    return new Error(error(e));
                }
            },
        };
    }

    public getSupportedStream(): Stream.Reference[] {
        if (getCompatibilityMod().Streams[this.ref.alias() as string] === undefined) {
            throw new Error(
                `Entity "${this.ref.alias()}" isn't registred in compatibility.Streams list`,
            );
        }
        return getCompatibilityMod().Streams[this.ref.alias() as string];
    }

    public getSupportedFileType(): File.FileType[] {
        if (getCompatibilityMod().Files[this.ref.alias() as string] === undefined) {
            throw new Error(
                `Entity "${this.ref.alias()}" isn't registred in compatibility.Files list`,
            );
        }
        return getCompatibilityMod().Files[this.ref.alias() as string];
    }

    public isSdeSupported(): boolean {
        if (getCompatibilityMod().SDESupport[this.ref.alias() as string] === undefined) {
            throw new Error(
                `Entity "${this.ref.alias()}" isn't registred in compatibility.SDESupport list`,
            );
        }
        return getCompatibilityMod().SDESupport[this.ref.alias() as string];
    }

    public sterilized(): T {
        return obj.sterilize(this.configuration, [STAMP]);
    }
}
