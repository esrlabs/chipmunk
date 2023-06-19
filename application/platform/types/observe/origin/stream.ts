import { error } from '../../../log/utils';
import { Configuration as Base, ConfigurationStatic } from '../configuration';
import { Context, SourceUuid } from './index';
import { OriginDetails, IOriginDetails, Job, IJob } from '../description';
import { Statics } from '../../../env/decorators';
import { unique } from '../../../env/sequence';
import { Mutable } from '../../unity/mutable';
import { Alias } from '../../env/types';

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

    protected setInstance() {
        const instance = new Stream.Configuration(this.configuration[1]);
        if (instance instanceof Error) {
            throw instance;
        }
        (this as Mutable<Configuration>).instance = instance;
    }

    public readonly instance!: Stream.Configuration;

    constructor(configuration: IConfiguration) {
        super(configuration);
        this.setInstance();
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

    public getStreamConfiguration(): Stream.IConfiguration {
        return this.configuration[1];
    }

    public as<T>(
        Ref: { new (...args: any[]): Stream.Declaration } & Alias<unknown>,
    ): T | undefined {
        return this.instance.instance.alias() === Ref.alias() ? (this.instance as T) : undefined;
    }
}
