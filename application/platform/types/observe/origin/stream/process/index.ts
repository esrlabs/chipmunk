import { error } from '../../../../../log/utils';
import { Source } from '../index';
import { Configuration as Base, ConfigurationStaticDesc } from '../../../configuration';
import { OriginDetails, IOriginDetails, IList, Job, IJob, OriginType } from '../../../description';
import { Statics } from '../../../../../env/decorators';

import * as obj from '../../../../../env/obj';
import * as Parser from '../../../parser';
import * as Sde from '../../../sde';

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
}
