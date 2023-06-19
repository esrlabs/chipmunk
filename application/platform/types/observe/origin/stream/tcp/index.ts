import { error } from '../../../../../log/utils';
import { Source } from '../index';
import { Configuration as Base, ConfigurationStaticDesc } from '../../../configuration';
import { OriginDetails, IOriginDetails, IList, Job, IJob, OriginType } from '../../../description';
import { Statics } from '../../../../../env/decorators';

import * as obj from '../../../../../env/obj';
import * as Parser from '../../../parser';
import * as Sde from '../../../sde';

export interface IConfiguration {
    bind_addr: string;
}

@Statics<ConfigurationStaticDesc<IConfiguration, Source>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Source>
    implements OriginDetails, Sde.Support, Job
{
    static desc(): IList {
        return {
            major: `TCP`,
            minor: 'TCP Connection',
            icon: 'network_wifi_3_bar',
        };
    }

    static alias(): Source {
        return Source.TCP;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            obj.getAsNotEmptyString(configuration, 'bind_addr');
            return configuration;
        } catch (e) {
            return new Error(error(e));
        }
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return {
            bind_addr: '0.0.0.0',
        };
    }

    public desc(): IOriginDetails {
        return {
            major: this.configuration.bind_addr,
            minor: '',
            icon: 'network_wifi_3_bar',
            type: OriginType.net,
            state: {
                running: 'listening',
                stopped: '',
            },
        };
    }

    public asJob(): IJob {
        return {
            name: `TCP: ${this.configuration.bind_addr}`,
            desc: `Connecting to ${this.configuration.bind_addr} via TCP`,
            icon: 'network_wifi_3_bar',
        };
    }

    public getSupportedParsers(): Parser.Reference[] {
        return [Parser.Dlt.Configuration];
    }
}
