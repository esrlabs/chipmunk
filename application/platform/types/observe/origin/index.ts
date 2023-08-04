import { Configuration as Base, ConfigurationStatic, Linked } from '../configuration';
import { Statics } from '../../../env/decorators';
import { Mutable } from '../../unity/mutable';
import { Alias } from '../../env/types';
import { OriginDetails, IOriginDetails, Job, IJob } from '../description';

export * as File from './file';
export * as Concat from './concat';
export * as Stream from './stream';

import * as File from './file';
import * as Concat from './concat';
import * as Stream from './stream';
import * as Parser from '../parser';
import * as Sde from '../sde';

export enum Context {
    File = 'File',
    Concat = 'Concat',
    Stream = 'Stream',
}

export type SourceUuid = string;

export interface OnChange {
    onOriginChange(origin: Configuration): void;
}

export interface IConfiguration {
    [Context.File]?: File.IConfiguration;
    [Context.Concat]?: Concat.IConfiguration;
    [Context.Stream]?: Stream.IConfiguration;
}

export const REGISTER = {
    [Context.File]: File.Configuration,
    [Context.Concat]: Concat.Configuration,
    [Context.Stream]: Stream.Configuration,
};

export const DEFAULT = File.Configuration;

export type Declaration = File.Configuration | Concat.Configuration | Stream.Configuration;

export type OriginNature = File.Configuration | Concat.Configuration | Stream.Stream.Declaration;

@Statics<ConfigurationStatic<IConfiguration, undefined>>()
export class Configuration
    extends Base<IConfiguration, Configuration, undefined>
    implements Parser.Support, Sde.Support, Job, OriginDetails
{
    static alias(): undefined {
        return undefined;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        if (
            Object.keys(REGISTER)
                .map((k) => configuration[k as Context])
                .filter((v) => v !== undefined).length === 0
        ) {
            return new Error(`Origin isn't defined`);
        }
        let error: Error | undefined;
        Object.keys(REGISTER).forEach((key) => {
            if (error instanceof Error) {
                return;
            }
            const config = configuration[key as Context];
            if (config === undefined) {
                return;
            }
            const err = REGISTER[key as Context].validate(config as any);
            if (err instanceof Error) {
                error = err;
            } else {
                error = undefined;
            }
        });
        return error instanceof Error ? error : configuration;
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return {
            [DEFAULT.alias()]: DEFAULT.initial(),
        };
    }

    protected getContextKey(): Context | undefined {
        let found: Context | undefined;
        Object.keys(REGISTER).forEach((key) => {
            if (found !== undefined) {
                return;
            }
            if (this.configuration[key as Context] === undefined) {
                return;
            }
            found = key as Context;
        });
        return found;
    }

    protected setInstance(): Configuration {
        const context = this.getContextKey();
        if (context === undefined) {
            throw new Error(`Configuration of stream doesn't have definition of known context.`);
        }
        if (this.instance !== undefined && this.instance.alias() === context) {
            this.instance.setRef(this.configuration[context]);
            return this;
        }
        this.instance !== undefined && this.instance.destroy();
        (this as Mutable<Configuration>).instance = new REGISTER[context](
            this.configuration[context] as any,
            {
                watcher: this.watcher,
                overwrite: (config: IConfiguration) => {
                    this.overwrite(config);
                    return this.configuration[context] as any;
                },
            },
        );
        return this;
    }

    public readonly instance!: Declaration;

    constructor(configuration: IConfiguration, linked: Linked<IConfiguration> | undefined) {
        super(configuration, linked);
        this.register(
            this.watcher.subscribe(() => {
                if (this.overwriting) {
                    return;
                }
                this.setInstance();
            }),
        );
        this.setInstance();
    }

    public override destroy(): void {
        super.destroy();
        this.instance !== undefined && this.instance.destroy();
    }

    public source(): string | undefined {
        return this.instance.source();
    }

    public files(): string[] | string | undefined {
        if (this.instance instanceof File.Configuration) {
            return this.instance.filename();
        } else if (this.instance instanceof Concat.Configuration) {
            return this.instance.files();
        } else {
            return undefined;
        }
    }

    public change(origin: Declaration): void {
        this.overwrite({ [origin.alias()]: origin.configuration });
    }

    public desc(): IOriginDetails {
        return this.instance.desc();
    }

    public title(): string {
        const desc = this.desc().major;
        if (desc.trim() === '') {
            if (this.instance instanceof File.Configuration) {
                return File.Configuration.desc().major;
            } else if (this.instance instanceof Concat.Configuration) {
                return Concat.Configuration.desc().major;
            } else if (this.instance instanceof Stream.Configuration) {
                return Stream.Configuration.desc().major;
            } else {
                throw new Error(`Origin type isn't supported yet`);
            }
        } else {
            return desc;
        }
    }

    public asJob(): IJob {
        return this.instance.asJob();
    }

    public override isSdeSupported(): boolean {
        return this.instance.isSdeSupported();
    }

    public getSupportedParsers(): Parser.Reference[] {
        return this.instance.getSupportedParsers();
    }

    public as<T>(
        Ref: { new (...args: any[]): Declaration | Stream.Stream.Declaration } & Alias<unknown>,
    ): T | undefined {
        if (this.instance.alias() === Ref.alias()) {
            return this.instance as T;
        }
        if (typeof (this.instance as any).as === 'function') {
            return (this.instance as any).as(Ref);
        }
        return undefined;
    }

    public nature(): OriginNature {
        if (this.instance instanceof Stream.Configuration) {
            return this.instance.instance.instance;
        } else {
            return this.instance;
        }
    }

    public getNatureAlias(): Context | Stream.Stream.Source {
        if (this.instance instanceof Stream.Configuration) {
            return this.instance.instance.instance.alias();
        } else {
            return this.instance.alias();
        }
    }

    public set(): {
        alias(alias?: string): void;
    } {
        return {
            // Change signature of source
            alias: (alias?: string): void => {
                this.instance.set().alias(alias);
            },
        };
    }

    public override storable(): IConfiguration {
        return { [this.instance.alias()]: this.instance.storable() };
    }

    public override hash(): number {
        return this.instance.hash();
    }
}
