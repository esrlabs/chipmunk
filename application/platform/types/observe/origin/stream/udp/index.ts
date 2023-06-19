import { error } from '../../../../../log/utils';
import { Source } from '../index';
import { Configuration as Base, ConfigurationStaticDesc } from '../../../configuration';
import { OriginDetails, IOriginDetails, IList, Job, IJob, OriginType } from '../../../description';
import { Statics } from '../../../../../env/decorators';

import * as obj from '../../../../../env/obj';
import * as Parser from '../../../parser';
import * as Sde from '../../../sde';

export interface Multicast {
    multiaddr: string;
    interface: string | undefined;
}

export interface IConfiguration {
    bind_addr: string;
    multicast: Multicast[];
}

@Statics<ConfigurationStaticDesc<IConfiguration, Source>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Source>
    implements OriginDetails, Sde.Support, Job
{
    static desc(): IList {
        return {
            major: `UDP`,
            minor: 'UDP Connection',
            icon: 'network_wifi_3_bar',
        };
    }

    static alias(): Source {
        return Source.UDP;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            obj.getAsNotEmptyString(configuration, 'bind_addr');
            obj.getAsArray(configuration, 'multicast');
            configuration.multicast.forEach((multicast: Multicast) => {
                obj.getAsNotEmptyString(multicast, 'multiaddr');
                obj.getAsArrayOfNotEmptyString(multicast, 'interface');
            });
            return configuration;
        } catch (e) {
            return new Error(error(e));
        }
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return {
            bind_addr: '0.0.0.0',
            multicast: [],
        };
    }

    public desc(): IOriginDetails {
        return {
            major: this.configuration.bind_addr,
            minor:
                this.configuration.multicast.length === 0
                    ? ''
                    : this.configuration.multicast.map((m) => m.multiaddr).join(', '),
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
            name: `UDP: ${this.configuration.bind_addr}`,
            desc:
                this.configuration.multicast.length === 0
                    ? `Connecting to ${this.configuration.bind_addr} via UDP (no multicasts)`
                    : this.configuration.multicast.map((m) => m.multiaddr).join(', '),
            icon: 'network_wifi_3_bar',
        };
    }

    public getSupportedParsers(): Parser.Reference[] {
        return [Parser.Dlt.Configuration, Parser.SomeIp.Configuration];
    }
}
