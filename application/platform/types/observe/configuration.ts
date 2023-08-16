import { error } from '../../log/utils';
import { JsonConvertor } from '../storage/json';
import { Validate, SelfValidate, Alias, Destroy, Storable, Hash } from '../env/types';
import { List } from './description';
import { scope } from '../../env/scope';
import { Subject, Subscriber, Subscription } from '../../env/subscription';
import { unique } from '../../env/sequence';
import { Observer } from '../../env/observer';

import * as Stream from './origin/stream/index';
import * as File from './types/file';

export interface ConfigurationStatic<T, A> extends Validate<T>, Alias<A> {
    initial(): T;
}

export interface ConfigurationStaticDesc<T, A> extends Validate<T>, Alias<A>, List {
    initial(): T;
}

export interface Reference<T, C, A> extends ConfigurationStatic<T, A> {
    // new (configuration: T, linked: Linked<T> | undefined): C & Configuration<T, C, A>;
    new (...args: any[]): C & Configuration<T, C, A>;
}

export interface ReferenceDesc<T, C, A> extends ConfigurationStaticDesc<T, A> {
    // new (configuration: T, linked: Linked<T> | undefined): C & Configuration<T, C, A>;
    new (...args: any[]): C & Configuration<T, C, A>;
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

export type TOverwriteHandler<T> = (configuration: T) => T;

export interface Linked<T> {
    overwrite: TOverwriteHandler<T>;
    watcher: Subject<void>;
}

export abstract class Configuration<T, C, A>
    extends Subscriber
    implements
        JsonConvertor<Configuration<T, C, A>>,
        SelfValidate,
        Storable<T>,
        Hash<number>,
        Destroy
{
    protected ref: Reference<T, C, A>;
    protected readonly src: T;
    protected readonly observer: Observer<T> | undefined;
    protected readonly linked: Linked<T> | undefined;
    protected overwriting: boolean = false;

    public readonly uuid: string = unique();
    public watcher: Subject<void> = new Subject();

    protected getOriginWatcher(): Subject<any> {
        if (this.linked !== undefined) {
            return this.linked.watcher;
        }
        if (this.observer !== undefined) {
            return this.observer.watcher;
        }
        throw new Error(`002: Configuration doesn't have observer or linked`);
    }

    constructor(configuration: T, linked: Linked<T> | undefined) {
        super();
        if (typeof this.constructor !== 'function') {
            throw new Error(`Fail to get reference to Constructor`);
        }
        this.ref = this.constructor as Reference<T, C, A>;
        this.src = configuration;
        this.linked = linked;
        if (linked === undefined) {
            this.observer = new Observer(configuration);
        }
        this.register(
            this.getOriginWatcher().subscribe(() => {
                if (this.overwriting) {
                    return;
                }
                this.watcher.emit();
            }),
        );
    }

    public get configuration(): T {
        if (this.linked !== undefined) {
            return this.src;
        }
        if (this.observer !== undefined) {
            return this.observer.target;
        }
        throw new Error(`001: Configuration doesn't have observer or linked`);
    }

    public destroy(): void {
        if (this.observer !== undefined) {
            this.observer.destroy();
        }
        this.watcher.destroy();
        this.unsubscribe();
    }

    public validate(): Error | undefined {
        const error: Error | T = this.ref.validate(this.sterilized());
        return error instanceof Error ? error : undefined;
    }

    public alias(): A {
        return this.ref.alias();
    }

    public overwrite(configuration: T): void {
        this.overwriting = true;
        if (this.linked !== undefined) {
            (this as any).src = this.linked.overwrite(configuration);
        } else if (this.observer !== undefined) {
            (this as any).src = Observer.sterilize(configuration);
            this.observer.overwrite(configuration);
        } else {
            this.overwriting = false;
            throw new Error(`004: Configuration doesn't have observer or linked`);
        }
        this.overwriting = false;
        this.watcher.emit();
    }

    public setRef<C>(configuration: T | C): void {
        if (this.linked !== undefined) {
            (this as any).src = configuration;
        } else if (this.observer !== undefined) {
            throw new Error(`005: Only linked configuration can be rerefered to new target`);
        } else {
            throw new Error(`006: Configuration doesn't have observer or linked`);
        }
    }

    public subscribe(handler: () => void): Subscription {
        return this.watcher.subscribe(() => {
            setTimeout(handler);
        });
    }

    public json(): {
        to(): string;
        from(str: string): Configuration<T, C, A> | Error;
    } {
        return {
            to: (): string => {
                if (this.linked !== undefined) {
                    return JSON.stringify(Observer.sterilize(this.src));
                }
                if (this.observer !== undefined) {
                    return JSON.stringify(this.observer.sterilize());
                }
                throw new Error(`007: Configuration doesn't have observer or linked`);
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
                `008: Entity "${this.ref.alias()}" isn't registred in compatibility.Streams list`,
            );
        }
        return getCompatibilityMod().Streams[this.ref.alias() as string];
    }

    public getSupportedFileType(): File.FileType[] {
        if (getCompatibilityMod().Files[this.ref.alias() as string] === undefined) {
            throw new Error(
                `009: Entity "${this.ref.alias()}" isn't registred in compatibility.Files list`,
            );
        }
        return getCompatibilityMod().Files[this.ref.alias() as string];
    }

    public isSdeSupported(): boolean {
        if (getCompatibilityMod().SDESupport[this.ref.alias() as string] === undefined) {
            throw new Error(
                `010: Entity "${this.ref.alias()}" isn't registred in compatibility.SDESupport list`,
            );
        }
        return getCompatibilityMod().SDESupport[this.ref.alias() as string];
    }

    public sterilized(): T {
        if (this.linked !== undefined) {
            return Observer.sterilize<T>(this.src);
        }
        if (this.observer !== undefined) {
            return this.observer.sterilize();
        }
        throw new Error(`011: Configuration doesn't have observer or linked`);
    }

    // This is default implementation, but in some cases (like "Stream.Process")
    // it should be adjusted
    public storable(): T {
        return this.sterilized();
    }

    public abstract hash(): number;
}
