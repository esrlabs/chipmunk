import { Configuration as Base, ConfigurationStaticDesc } from '../configuration';
import { OriginDetails, Job, IOriginDetails, IJob, OriginType, IList } from '../description';
import { Context, SourceUuid } from './index';
import { Statics } from '../../../env/decorators';
import { unique } from '../../../env/sequence';
import { error } from '../../../log/utils';

import * as Types from '../types';
import * as Sde from '../sde';
import * as Parser from '../parser';
import * as str from '../../../env/str';

export type IConfiguration = [SourceUuid, Types.Plugin.PluginDirPath];
const CONFIG_LEN = 2 as const;

@Statics<ConfigurationStaticDesc<IConfiguration, Context>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Context>
    implements OriginDetails, Sde.Support, Parser.Support, Job
{
    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return [unique(), ''];
    }

    static alias(): Context {
        return Context.Plugin;
    }

    static desc(): IList {
        return {
            major: 'Plugin source static major TODO',
            minor: 'Plugin source static minor TODO',
            icon: undefined,
        };
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            if (configuration instanceof Array && configuration.length === CONFIG_LEN) {
                str.asNotEmptyString(
                    configuration[0],
                    `SourceUuid isn't found: ${configuration[0]}`,
                );
                str.asNotEmptyString(
                    configuration[1],
                    `Pluging Directory Path isn't found: ${configuration[1]}`,
                );
            } else {
                throw new Error(
                    `Source "${Context.Plugin}" should be represented as an array, len = ${CONFIG_LEN}`,
                );
            }

            return configuration;
        } catch (e) {
            return new Error(error(e));
        }
    }

    public source(): string | undefined {
        return this.configuration[0];
    }

    //TODO AAZ: Complete this one all other plugins info are set.
    public set(): {
        alias(alias?: string): void;
        pluginDir(dir: string): void;
    } {
        return {
            alias: (alias?: string): void => {
                this.configuration[0] = alias === undefined ? unique() : alias;
            },
            pluginDir: (dir: string): void => {
                this.configuration[1] = dir;
            },
        };
    }

    public override hash(): number {
        return str.hash(this.dirPath());
    }

    public dirPath(): Types.Plugin.PluginDirPath {
        return this.configuration[1];
    }

    public getSupportedParsers(): Parser.Reference[] {
        // Returns all
        return [
            Parser.Dlt.Configuration,
            Parser.SomeIp.Configuration,
            Parser.Text.Configuration,
            Parser.Plugin.Configuration,
        ];
    }
    public asJob(): IJob {
        return {
            name: 'plugin source',
            desc: 'plugin source TODO',
            icon: undefined,
        };
    }
    public desc(): IOriginDetails {
        return {
            major: 'Plugin source instance major TODO',
            minor: 'Plugin source instance minor TODO',
            icon: undefined,
            type: OriginType.plugin,
            action: 'Load TODO',
            state: {
                running: 'load TODO',
                stopped: 'TODO',
            },
        };
    }
}
