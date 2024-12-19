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

import { ConfigItem, ConfigValue } from '../../../../types/plugins';

export interface IConfiguration {
    plugin_path: string;
    plugin_configs: ConfigItem[];
}

@Statics<ConfigurationStaticDesc<IConfiguration, Protocol>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Protocol>
    implements List, Stream.Support, Files.Support
{
    static desc(): IList {
        return {
            major: 'Plugins',
            minor: 'Plugin parser static minor TODO',
            icon: undefined,
        };
    }

    static alias(): Protocol {
        return Protocol.Plugin;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            const pluginPath = obj.getAsString(configuration, 'plugin_path');
            if (pluginPath.length == 0) {
                return Error('No Valid Plugin Parser is selected.');
            }

            obj.getAsArray(configuration, 'plugin_configs');

            return configuration;
        } catch (e) {
            return new Error(error(e));
        }
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return {
            plugin_path: '',
            plugin_configs: [],
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
        // Plugin parsers don't need to react on changing source at the current implementation.
    }

    //TODO AAZ: Remove temp function after better types.
    getConfigVal(value: ConfigValue): any {
        return (
            value.Boolean ??
            value.Text ??
            value.Number ??
            value.Float ??
            value.Path ??
            value.DropDown
        );
    }

    public override hash(): number {
        const configs = this.configuration.plugin_configs.map(
            (item) => `${item.id}:${this.getConfigVal(item.value)}`,
        );
        return str.hash(`${this.configuration.plugin_path}; ${configs.join(';')}`);
    }
}
