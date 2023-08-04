import { error } from '../../../log/utils';
import { Configuration as Base, ConfigurationStatic, Linked } from '../configuration';
import { Context, SourceUuid } from './index';
import { OriginDetails, IOriginDetails, IList, Job, IJob } from '../description';
import { Statics } from '../../../env/decorators';
import { unique } from '../../../env/sequence';
import { Alias } from '../../env/types';
import { Mutable } from '../../unity/mutable';

import * as str from '../../../env/str';
import * as Stream from './stream/index';
import * as Parser from '../parser/index';
import * as Sde from '../sde';

export * as str from '../../../env/str';
export * as Stream from './stream/index';
export * as Parser from '../parser/index';
export * as Sde from '../sde';

export type IConfiguration = [SourceUuid, Stream.IConfiguration];

@Statics<ConfigurationStatic<IConfiguration, Context>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Context>
    implements OriginDetails, Sde.Support, Parser.Support, Job
{
    static desc(): IList {
        return {
            major: `Stream`,
            minor: 'Streaming',
            icon: 'files',
        };
    }

    static alias(): Context {
        return Context.Stream;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            if (configuration instanceof Array && configuration.length === 2) {
                str.asNotEmptyString(
                    configuration[0],
                    `SourceUuid isn't found: ${configuration[0]}`,
                );
                const error = Stream.Configuration.validate(configuration[1]);
                return error instanceof Error ? error : configuration;
            } else {
                throw new Error(
                    `Source "${Context.Stream}" should be represented as an array, len = 2.`,
                );
            }
        } catch (e) {
            return new Error(error(e));
        }
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return [unique(), Stream.Configuration.initial()];
    }

    protected setInstance(): Configuration {
        if (this.instance !== undefined) {
            this.instance.setRef(this.configuration[1]);
            return this;
        } else {
            const instance = new Stream.Configuration(this.configuration[1], {
                watcher: this.watcher,
                overwrite: (config: Stream.IConfiguration) => {
                    this.configuration[1] = config;
                    return this.configuration[1];
                },
            });
            if (instance instanceof Error) {
                throw instance;
            }
            (this as Mutable<Configuration>).instance = instance;
        }
        return this;
    }

    public readonly instance!: Stream.Configuration;

    constructor(configuration: IConfiguration, linked: Linked<IConfiguration> | undefined) {
        super(configuration, linked);
        this.register(
            this.watcher.subscribe(() => {
                this.setInstance();
            }),
        );
        this.setInstance();
    }

    public source(): string | undefined {
        return this.configuration[0];
    }

    public override destroy(): void {
        super.destroy();
        this.instance !== undefined && this.instance.destroy();
    }

    public change(stream: Stream.Declaration): void {
        this.instance.change().byDeclaration(stream);
        this.configuration[1] = this.instance.configuration;
    }

    public desc(): IOriginDetails {
        return this.instance.desc();
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

    public set(): {
        alias(alias?: string): void;
    } {
        return {
            alias: (alias?: string): void => {
                this.configuration[0] = alias === undefined ? unique() : alias;
            },
        };
    }

    public as<T>(
        Ref: { new (...args: any[]): Stream.Declaration } & Alias<unknown>,
    ): T | undefined {
        return this.instance.instance.alias() === Ref.alias()
            ? (this.instance.instance as T)
            : undefined;
    }

    public override storable(): IConfiguration {
        return [this.configuration[0], this.instance.storable()];
    }

    public override hash(): number {
        return this.instance.hash();
    }
}
