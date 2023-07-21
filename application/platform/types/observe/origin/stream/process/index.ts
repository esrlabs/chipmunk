import { error } from '../../../../../log/utils';
import { Source } from '../index';
import { Configuration as Base, ConfigurationStaticDesc } from '../../../configuration';
import { OriginDetails, IOriginDetails, IList, Job, IJob, OriginType } from '../../../description';
import { Statics } from '../../../../../env/decorators';

import * as obj from '../../../../../env/obj';
import * as Parser from '../../../parser';
import * as Sde from '../../../sde';
import * as str from '../../../../../env/str';

export interface IConfiguration {
    command: string;
    cwd: string;
    envs: { [key: string]: string };
}

@Statics<ConfigurationStaticDesc<IConfiguration, Source>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Source>
    implements OriginDetails, Sde.Support, Job
{
    public MARKER = 'application/platform/types/observe/origin/stream/process/index.ts';

    static desc(): IList {
        return {
            major: `Terminal`,
            minor: 'Executing Terminal Command',
            icon: 'web_asset',
        };
    }

    static alias(): Source {
        return Source.Process;
    }

    static sterilizeEnvVars(envs: { [key: string]: any }): { [key: string]: string } {
        Object.keys(envs).forEach((key: string) => {
            if (typeof envs[key] === 'string') {
                return;
            }
            if (typeof envs[key].toString === 'function') {
                envs[key] = envs[key].toString();
            } else {
                envs[key] = JSON.stringify(envs[key]);
            }
        });
        return envs;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            obj.getAsNotEmptyString(configuration, 'command');
            obj.getAsString(configuration, 'cwd');
            obj.getAsObjWithPrimitives(configuration, 'envs');
            return configuration;
        } catch (e) {
            return new Error(error(e));
        }
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return {
            command: '',
            cwd: '',
            envs: {},
        };
    }

    public desc(): IOriginDetails {
        return {
            major: `${this.configuration.command}`,
            minor: this.configuration.cwd === '' ? 'no defined cwd' : this.configuration.cwd,
            icon: 'web_asset',
            action: 'Execute',
            type: OriginType.command,
            state: {
                running: 'spawning',
                stopped: '',
            },
        };
    }

    public asJob(): IJob {
        return {
            name: `${this.configuration.command}`,
            desc: `${this.configuration.command}`,
            icon: 'web_asset',
        };
    }

    public getSupportedParsers(): Parser.Reference[] {
        return [Parser.Text.Configuration];
    }

    public override storable(): IConfiguration {
        const sterilized = this.sterilized();
        sterilized.envs = {};
        // Doesn't make sense to store envvars collection.
        return sterilized;
    }

    public override hash(): number {
        return str.hash(`${this.configuration.command};${this.configuration.cwd}`);
    }
}
