import { Configuration as Base, getCompatibilityMod } from './configuration';
import { Mutable } from '../unity/mutable';
import { LockToken } from '../../env/lock.token';
import { Signature } from '../env/types';

import * as Parser from './parser';
import * as Origin from './origin';
import * as Sde from './sde';

export * as Parser from './parser';
export * as Origin from './origin';
export * as Types from './types';
export * as Description from './description';

export { IList, IOriginDetails, IJob } from './description';

export interface IObserve {
    origin: Origin.IConfiguration;
    parser: Parser.IConfiguration;
}

export class Observe
    extends Base<IObserve, Observe, undefined>
    implements Sde.Support, Parser.Support, Signature<string>
{
    static new(): Observe {
        return new Observe({
            parser: {
                Dlt: Parser.Dlt.Configuration.initial(),
            },
            origin: {
                Stream: Origin.Stream.Configuration.initial(),
            },
        });
    }

    static from(json: string): Observe | Error {
        const observe = new Observe({
            parser: {
                Dlt: Parser.Dlt.Configuration.initial(),
            },
            origin: {
                Stream: Origin.Stream.Configuration.initial(),
            },
        });
        const error = observe.json().from(json);
        return error instanceof Error ? error : observe;
    }

    static alias(): undefined {
        return undefined;
    }

    static initial(): IObserve {
        return {
            origin: Origin.Configuration.initial(),
            parser: Parser.Configuration.initial(),
        };
    }

    static validate(configuration: IObserve): Error | IObserve {
        let error: Error | unknown = Origin.Configuration.validate(configuration.origin);
        if (error instanceof Error) {
            return error;
        }
        error = Parser.Configuration.validate(configuration.parser);
        return error instanceof Error ? error : configuration;
    }

    public readonly origin!: Origin.Configuration;
    public readonly parser!: Parser.Configuration;

    /// Lock-state
    /// Allows define a way to process observe data.
    /// true - observe data can be used to observe (create a session);
    /// false - observe data probably requires some addition configuration
    /// for example settings of DLT or SomeIP
    protected readonly lock: LockToken = new LockToken(false);

    protected link(): void {
        (this as Mutable<Observe>).origin = new Origin.Configuration(this.configuration.origin, {
            watcher: this.watcher,
            overwrite: (config: Origin.IConfiguration) => {
                this.configuration.origin = config;
                return this.configuration.origin;
            },
        });
        (this as Mutable<Observe>).parser = new Parser.Configuration(this.configuration.parser, {
            watcher: this.watcher,
            overwrite: (config: Parser.IConfiguration) => {
                this.configuration.parser = config;
                return this.configuration.parser;
            },
        });
    }

    protected onOriginChange() {
        this.parser.onOriginChange(this.origin);
    }

    constructor(observe: IObserve) {
        super(observe, undefined);
        this.link();
        this.parser.onOriginChange(this.origin);
        this.origin.watcher.subscribe(this.onOriginChange.bind(this));
        this.parser.watcher.subscribe(this.onOriginChange.bind(this));
    }

    public override destroy(): void {
        super.destroy();
        this.parser !== undefined && this.parser.destroy();
        this.origin !== undefined && this.origin.destroy();
    }

    public override isSdeSupported(): boolean {
        return this.origin.isSdeSupported();
    }

    public override overwrite(configuration: IObserve): void {
        this.origin !== undefined && this.origin.destroy();
        this.parser !== undefined && this.parser.destroy();
        super.overwrite(configuration);
        this.link();
    }

    public getSupportedParsers(): Parser.Reference[] {
        return this.origin.getSupportedParsers();
    }

    public clone(): Observe {
        const cloned = new Observe(this.sterilized());
        // Drop alias to prevent multiple observing entries with same UUID
        cloned.origin.set().alias();
        return cloned;
    }

    public locker(): {
        lock(): Observe;
        unlock(): Observe;
        // Lock configuration if it's possible to lock
        guess(): Observe;
        is(): boolean;
    } {
        return {
            lock: (): Observe => {
                this.lock.lock();
                return this;
            },
            unlock: (): Observe => {
                this.lock.unlock();
                return this;
            },
            guess: (): Observe => {
                if (this.parser.instance instanceof Parser.Text.Configuration) {
                    this.lock.lock();
                }
                return this;
            },
            is: (): boolean => {
                return this.lock.isLocked();
            },
        };
    }

    public isConfigurable(): boolean {
        const map: any = getCompatibilityMod().Configurable;
        const nature = this.origin.nature().alias();
        const parser = this.parser.alias();
        if (typeof map[nature] === 'boolean') {
            return map[nature];
        } else if (typeof map[nature][parser] === 'boolean') {
            return map[nature][parser];
        }
        throw new Error(
            `Parser "${parser}" and origin "${nature}" don't have description in Compatibility.Configurable table`,
        );
    }

    public override storable(): IObserve {
        return {
            origin: this.origin.storable(),
            parser: this.parser.storable(),
        };
    }

    public override hash(): number {
        return this.origin.hash() + this.parser.hash();
    }

    public signature(): string {
        return `${this.origin.hash()}${this.parser.hash()}`;
    }
}
