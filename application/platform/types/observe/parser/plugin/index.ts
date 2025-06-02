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

import { PluginConfigItem, PluginConfigValue } from '../../../bindings/plugins';

export interface IConfiguration {
    plugin_path: string;
    plugin_configs: PluginConfigItem[];
}

@Statics<ConfigurationStaticDesc<IConfiguration, Protocol>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Protocol>
    implements List, Stream.Support, Files.Support
{
    /// Plugin uses inner data to provide self description. In run-time fields
    /// `major` will be replaced with plugin name; `minor` with an addition data
    /// more details: `WrappedParserRef` (application/client/src/app/ui/tabs/observe/state.ts)
    static desc(): IList {
        return {
            major: '',
            minor: '',
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

    static inited(): boolean {
        return Configuration.desc().major.trim() !== '';
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

    /**
     * Extract the value from the configuration value item depending on its kind,
     * returning a value that can represented as a formatted string.
     */
    getConfigValue(value: PluginConfigValue): string | number | boolean {
        if ('Boolean' in value) {
            return value.Boolean;
        }

        if ('Integer' in value) {
            return value.Integer;
        }

        if ('Float' in value) {
            return value.Float;
        }

        if ('Text' in value) {
            return value.Text;
        }

        if ('Files' in value) {
            return value.Files.join(',');
        }

        if ('Directories' in value) {
            return value.Directories.join(',');
        }

        if ('Dropdown' in value) {
            return value.Dropdown;
        }

        assertNever(value);
    }

    public override hash(): number {
        const configs = this.configuration.plugin_configs.map(
            (item) => `${item.id}:${this.getConfigValue(item.value)}`,
        );
        return str.hash(`${this.configuration.plugin_path}; ${configs.join(';')}`);
    }
}

/**
 * Helper function to ensure the remaining item is never for exhausting matching at compile time,
 * and throwing an unhandled error at runtime.
 */
function assertNever(nev: never): never {
    throw new Error(`Unhandled case: ${JSON.stringify(nev)}`);
}
