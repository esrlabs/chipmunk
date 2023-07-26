import {
    Configuration as Base,
    ConfigurationStatic,
    ReferenceDesc,
    Linked,
} from '../../configuration';
import { OriginDetails, IOriginDetails, Job, IJob } from '../../description';
import { Statics } from '../../../../env/decorators';
import { Mutable } from '../../../unity/mutable';
import { Alias } from '../../../env/types';

import * as Process from './process';
import * as Serial from './serial';
import * as TCP from './tcp';
import * as UDP from './udp';
import * as Parser from '../../parser';
import * as Sde from '../../sde';

export * as Process from './process';
export * as Serial from './serial';
export * as TCP from './tcp';
export * as UDP from './udp';

export type Reference =
    | ReferenceDesc<Serial.IConfiguration, Serial.Configuration, Source>
    | ReferenceDesc<Process.IConfiguration, Process.Configuration, Source>
    | ReferenceDesc<TCP.IConfiguration, TCP.Configuration, Source>
    | ReferenceDesc<UDP.IConfiguration, UDP.Configuration, Source>;

export enum Source {
    TCP = 'TCP',
    UDP = 'UDP',
    Serial = 'Serial',
    Process = 'Process',
}

export type IDeclaration =
    | Serial.IConfiguration
    | Process.IConfiguration
    | TCP.IConfiguration
    | UDP.IConfiguration;

export type Declaration =
    | Serial.Configuration
    | Process.Configuration
    | TCP.Configuration
    | UDP.Configuration;

export interface IConfiguration {
    [Source.Serial]?: Serial.IConfiguration;
    [Source.Process]?: Process.IConfiguration;
    [Source.TCP]?: TCP.IConfiguration;
    [Source.UDP]?: UDP.IConfiguration;
}

export const REGISTER: {
    [key: string]: Reference;
} = {
    [Source.Process]: Process.Configuration,
    [Source.Serial]: Serial.Configuration,
    [Source.TCP]: TCP.Configuration,
    [Source.UDP]: UDP.Configuration,
};

export function getAllRefs(): Reference[] {
    return Object.keys(REGISTER).map((key) => REGISTER[key]);
}

export abstract class Support {
    public abstract getSupportedStream(): Reference[];
}

export const DEFAULT = TCP.Configuration;

export function getByAlias(alias: Source, configuration?: IDeclaration): Declaration {
    const Ref: Reference = REGISTER[alias];
    if (Ref === undefined) {
        throw new Error(`Unknown stream: ${alias}`);
    }
    return new Ref(configuration === undefined ? Ref.initial() : configuration, undefined);
}

export function getAliasByConfiguration(configuration: IConfiguration): Source {
    let detected: Source | undefined;
    Object.keys(configuration).forEach((key) => {
        if (REGISTER[key as Source] !== undefined) {
            if (detected !== undefined) {
                throw new Error(
                    `Configuration has a multiple source defined: ${JSON.stringify(configuration)}`,
                );
            }
            detected = key as Source;
        }
    });
    if (detected === undefined) {
        throw new Error(
            `Configuration doesn't have any known source: ${JSON.stringify(configuration)}`,
        );
    }
    return detected;
}

@Statics<ConfigurationStatic<IConfiguration, Source>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Source>
    implements OriginDetails, Sde.Support, Parser.Support, Job
{
    static alias(): Source {
        //TODO: alias should be defined for holders. Same for Parser as holder of parsers
        return Source.Process;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        if (
            Object.keys(REGISTER)
                .map((k) => configuration[k as Source])
                .filter((v) => v !== undefined).length === 0
        ) {
            return new Error(`Stream transport isn't defined`);
        }
        let error: Error | undefined;
        Object.keys(REGISTER).forEach((key) => {
            if (error instanceof Error) {
                return;
            }
            const config: any = configuration[key as Source];
            if (config === undefined) {
                return;
            }
            const err = REGISTER[key as Source].validate(config);
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

    protected getSourceKey(): Source | undefined {
        let found: Source | undefined;
        Object.keys(REGISTER).forEach((key) => {
            if (found !== undefined) {
                return;
            }
            if (this.configuration[key as Source] === undefined) {
                return;
            }
            found = key as Source;
        });
        return found;
    }

    protected setInstance(): Configuration {
        const source = this.getSourceKey();
        if (source === undefined) {
            throw new Error(`Configuration of stream doesn't have definition of known source.`);
        }
        if (this.configuration[source] === undefined) {
            throw new Error(`No source is defined in stream configuration`);
        }
        if (this.instance !== undefined && this.instance.alias() === source) {
            this.instance.setRef(this.configuration[source]);
            return this;
        }
        this.instance !== undefined && this.instance.destroy();
        (this as Mutable<Configuration>).instance = new REGISTER[source](
            this.configuration[source],
            {
                watcher: this.watcher,
                overwrite: (config: IConfiguration) => {
                    this.overwrite({ [source]: config });
                    return this.configuration[source];
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
                this.setInstance();
            }),
        );
        this.setInstance();
    }

    public override destroy(): void {
        super.destroy();
        this.instance !== undefined && this.instance.destroy();
    }

    public change(): {
        byConfiguration(configuration: IConfiguration): void;
        byDeclaration(declaration: Declaration): void;
        byReference(reference: Reference): void;
    } {
        return {
            byConfiguration: (configuration: IConfiguration): void => {
                this.overwrite(configuration);
            },
            byDeclaration: (stream: Declaration): void => {
                this.overwrite({ [stream.alias()]: stream.configuration });
            },
            byReference: (Ref: Reference): void => {
                this.overwrite({ [Ref.alias()]: new Ref(Ref.initial(), this.linked) });
            },
        };
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

    public as<T>(Ref: { new (...args: any[]): Declaration } & Alias<unknown>): T | undefined {
        if (this.instance.alias() === Ref.alias()) {
            return this.instance as T;
        }
        if (typeof (this.instance as any).as === 'function') {
            return (this.instance as any).as(Ref);
        }
        return undefined;
    }

    public override storable(): IConfiguration {
        return { [this.instance.alias()]: this.instance.storable() };
    }

    public override hash(): number {
        return this.instance.hash();
    }
}
