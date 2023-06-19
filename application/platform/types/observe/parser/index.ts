import { Configuration as Base, ConfigurationStatic, ReferenceDesc } from '../configuration';
import { Statics } from '../../../env/decorators';
import { List, IList } from '../description';
import { Mutable } from '../../unity/mutable';
import { Alias } from '../../env/types';

import * as Dlt from './dlt';
import * as SomeIp from './someip';
import * as Text from './text';

export * as Dlt from './dlt';
export * as SomeIp from './someip';
export * as Text from './text';
import * as Stream from '../origin/stream/index';
import * as Files from '../types/file';

export type Reference = ReferenceDesc<IDeclaration, Declaration, Protocol>;

export abstract class Support {
    public abstract getSupportedParsers(): Reference[];
}

export enum Protocol {
    Dlt = 'Dlt',
    SomeIp = 'SomeIp',
    Text = 'Text',
}

export type IDeclaration = Text.IConfiguration | Dlt.IConfiguration | SomeIp.IConfiguration;

export type Declaration = Text.Configuration | Dlt.Configuration | SomeIp.Configuration;

export interface IConfiguration {
    [Protocol.Dlt]?: Dlt.IConfiguration;
    [Protocol.SomeIp]?: SomeIp.IConfiguration;
    [Protocol.Text]?: Text.IConfiguration;
}

const REGISTER = {
    [Protocol.Dlt]: Dlt.Configuration,
    [Protocol.SomeIp]: SomeIp.Configuration,
    [Protocol.Text]: Text.Configuration,
};

const DEFAULT = Text.Configuration;

export function getByAlias(alias: Protocol): Declaration {
    const Ref: Reference = REGISTER[alias];
    if (Ref === undefined) {
        throw new Error(`Unknown parser: ${alias}`);
    }
    return new Ref(Ref.initial(), Ref);
}

@Statics<ConfigurationStatic<IConfiguration, Protocol>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Protocol>
    implements List, Stream.Support, Files.Support
{
    static alias(): Protocol {
        throw new Error(`Alias of parsers holder should be used`);
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        if (
            Object.keys(REGISTER)
                .map((k) => configuration[k as Protocol])
                .filter((v) => v !== undefined).length === 0
        ) {
            return new Error(`Stream transport isn't defined`);
        }
        let error: Error | undefined;
        Object.keys(REGISTER).forEach((key) => {
            if (error instanceof Error) {
                return;
            }
            const config: any = configuration[key as Protocol];
            if (config === undefined) {
                return;
            }
            // Error with "never" comes because text parser has settings NULL
            const err = REGISTER[key as Protocol].validate(config as never);
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

    protected setInstance(): void {
        const configuration = this.configuration;
        let instance: Declaration | undefined;
        Object.keys(REGISTER).forEach((key) => {
            if (instance !== undefined) {
                return;
            }
            const config: any = configuration[key as Protocol];
            if (config === undefined) {
                return;
            }
            const Ref: any = REGISTER[key as Protocol];
            instance = new Ref(config, Ref);
        });
        if (instance === undefined) {
            throw new Error(`Configuration of stream doesn't have definition of known source.`);
        }
        (this as Mutable<Configuration>).instance = instance;
        this.unsubscribe();
        this.register(
            this.instance.watcher.subscribe(() => {
                this.overwrite({
                    [this.instance.alias()]: this.instance.configuration,
                });
            }),
        );
    }

    public readonly instance!: Declaration;

    constructor(configuration: IConfiguration) {
        super(configuration);
        this.setInstance();
    }

    public change(parser: Declaration): void {
        this.overwrite({ [parser.alias()]: parser.configuration });
        this.setInstance();
    }

    public desc(): IList {
        return this.instance.desc();
    }

    public override getSupportedStream(): Stream.Reference[] {
        return this.instance.getSupportedStream();
    }

    public override alias(): Protocol {
        return this.instance.alias();
    }

    public override getSupportedFileType(): Files.FileType[] {
        return this.instance.getSupportedFileType();
    }

    public as<T>(Ref: { new (...args: any[]): Declaration } & Alias<unknown>): T | undefined {
        return this.instance.alias() === Ref.alias() ? (this.instance as T) : undefined;
    }
}
