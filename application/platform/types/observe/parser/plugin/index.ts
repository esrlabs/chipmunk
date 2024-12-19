import { error } from '../../../../log/utils';
import { Protocol } from '../index';
import { Configuration as Base, ConfigurationStaticDesc } from '../../configuration';
import { Statics } from '../../../../env/decorators';
import { List, IList } from '../../description';

import * as str from '../../../../env/str';
import * as Origin from '../../origin/index';
import * as Stream from '../../origin/stream/index';
import * as obj from '../../../../env/obj';
import * as Files from '../../types/file';

export interface IConfiguration {
    pluginDirPath: string;
}

@Statics<ConfigurationStaticDesc<IConfiguration, Protocol>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Protocol>
    implements List, Stream.Support, Files.Support
{
    static desc(): IList {
        return {
            major: 'Plugin parser static major TODO',
            minor: 'Plugin parser static minor TODO',
            icon: undefined,
        };
    }

    static alias(): Protocol {
        return Protocol.Plugin;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            obj.getAsString(configuration, 'pluginDirPath');
            return configuration;
        } catch (e) {
            return new Error(error(e));
        }
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return {
            pluginDirPath: '',
        };
    }

    public desc(): IList {
        return {
            major: 'Plugin parser instance major TODO',
            minor: 'Plugin parser instance minor TODO',
            icon: undefined,
        };
    }

    public onOriginChange(_origin: Origin.Configuration): void {
        //TODO:
    }

    public override hash(): number {
        return str.hash(this.configuration.pluginDirPath);
    }
}
