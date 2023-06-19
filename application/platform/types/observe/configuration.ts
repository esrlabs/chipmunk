import { error } from '../../log/utils';
import { JsonConvertor } from '../storage/json';
import { Validate, SelfValidate, Alias } from '../env/types';
import { List } from './description';
import { Mutable } from '../unity/mutable';
import { scope } from '../../env/scope';
import { Subject, Subscriber } from '../../env/subscription';

import * as Stream from './origin/stream/index';
import * as File from './types/file';

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

const PROXY_SERIALIZE_METHOD = '__serialize_proxy__';

export function serializeProxy<T>(entry: T): T {
    if (typeof (entry as any)[PROXY_SERIALIZE_METHOD] === 'function') {
        return (entry as any)[PROXY_SERIALIZE_METHOD]() as T;
    }
    return entry;
}

function observe<T>(entry: T, subject: Subject<void>): T {
    function wrap(entry: T) {
        (entry as any)[PROXY_SERIALIZE_METHOD] = () => {
            try {
                return JSON.parse(JSON.stringify(entry));
            } catch (err) {
                logger().error(`Fail to serialize proxy: ${error(err)}`);
            }
        };
        return entry;
    }
    function logger() {
        return scope.getLogger('ObserveConfig');
    }
    if (entry === null) {
        logger().warn(`Cannot observe null value`);
        return null as T;
    }
    if (['function', 'symbol'].includes(typeof entry)) {
        logger().warn(`Cannot observe ${typeof entry} value`);
        return undefined as T;
    }
    if (['string', 'number', 'boolean'].includes(typeof entry)) {
        return entry;
    }
    const set = (target: any, prop: string | symbol, value: any): boolean => {
        if (prop === PROXY_SERIALIZE_METHOD) {
            return true;
        }
        (target as any)[prop] = observe(serializeProxy(value), subject);
        subject.emit();
        return true;
    };
    if (entry instanceof Array) {
        return new Proxy(wrap(entry), { set }) as T;
    } else if (entry instanceof Object) {
        Object.keys(entry).forEach((key: string | number) => {
            // eslint-disable-next-line no-prototype-builtins
            if (!entry.hasOwnProperty(key) || key === PROXY_SERIALIZE_METHOD) {
                return;
            }
            const value = (entry as any)[key];
            if (['string', 'number', 'boolean'].indexOf(typeof value) !== -1) {
                return;
            } else if (value instanceof Array || value instanceof Object) {
                (entry as any)[key] = observe(value, subject);
            }
        });
        return new Proxy(wrap(entry), { set }) as T;
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
    implements JsonConvertor<Configuration<T, C, A>>, SelfValidate
{
    protected ref: Reference<T, C, A>;

    public readonly configuration: T;
    public readonly watcher: Subject<void> = new Subject();

    constructor(configuration: T) {
        super();
        if (typeof this.constructor !== 'function') {
            throw new Error(`Fail to get reference to Constructor`);
        }
        this.ref = this.constructor as Reference<T, C, A>;
        this.configuration = observe<T>(configuration, this.watcher);
    }

    public overwrite(configuration: T): void {
        (this as Mutable<Configuration<unknown, unknown, unknown>>).configuration = observe<T>(
            // We should serialize object, because it can be already Proxy
            serializeProxy(configuration),
            this.watcher,
        );
        this.watcher.emit();
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
                return JSON.stringify(this.configuration);
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
}
