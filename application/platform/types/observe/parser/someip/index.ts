import { error } from '../../../../log/utils';
import { Protocol } from '../index';
import { Configuration as Base, ConfigurationStaticDesc } from '../../configuration';
import { Statics } from '../../../../env/decorators';
import { List, IList } from '../../description';

import * as Stream from '../../origin/stream/index';
import * as obj from '../../../../env/obj';
import * as Files from '../../types/file';

export interface IConfiguration {
    fibex_file_paths: string[] | undefined;
}

@Statics<ConfigurationStaticDesc<IConfiguration, Protocol>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Protocol>
    implements List, Stream.Support, Files.Support
{
    static desc(): IList {
        return {
            major: 'SomeIp',
            minor: 'Parsing SomeIp tracers',
            icon: undefined,
        };
    }

    static alias(): Protocol {
        return Protocol.SomeIp;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            obj.getAsNotEmptyStringsArrayOrUndefined(configuration, 'fibex_file_paths');
            return configuration;
        } catch (e) {
            return new Error(error(e));
        }
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return {
            fibex_file_paths: [],
        };
    }

    public desc(): IList {
        return Configuration.desc();
    }

}
