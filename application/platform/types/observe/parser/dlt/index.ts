import { error } from '../../../../log/utils';
import { Protocol } from '../index';
import { Configuration as Base, ConfigurationStaticDesc } from '../../configuration';
import { Statics } from '../../../../env/decorators';
import { List, IList } from '../../description';

import * as Stream from '../../origin/stream/index';
import * as Files from '../../types/file';
import * as obj from '../../../../env/obj';
import * as Origin from '../../origin/index';
import * as str from '../../../../env/str';

export interface LevelDistribution {
    non_log: number;
    log_fatal: number;
    log_error: number;
    log_warning: number;
    log_info: number;
    log_debug: number;
    log_verbose: number;
    log_invalid: number;
}

export function getLogLevelName(level: number): string {
    const name = (DltLogLevelNames as Record<string, string>)[level];
    return name === undefined ? 'unknown' : name;
}

export interface StatisticInfo {
    app_ids: [string, LevelDistribution][];
    context_ids: [string, LevelDistribution][];
    ecu_ids: [string, LevelDistribution][];
    contained_non_verbose: boolean;
}

export const DltLogLevelNames = {
    1: 'Fatal',
    2: 'Error',
    3: 'Warn',
    4: 'Info',
    5: 'Debug',
    6: 'Verbose',
};

export enum LogLevel {
    Fatal = 1,
    Error = 2,
    Warn = 3,
    Info = 4,
    Debug = 5,
    Verbose = 6,
}

export interface IFilters {
    min_log_level: LogLevel | undefined;
    app_ids: string[] | undefined;
    ecu_ids: string[] | undefined;
    context_ids: string[] | undefined;
    app_id_count: number;
    context_id_count: number;
}

export interface IConfiguration {
    filter_config: IFilters | undefined;
    fibex_file_paths: string[] | undefined;
    with_storage_header: boolean;
}

@Statics<ConfigurationStaticDesc<IConfiguration, Protocol>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Protocol>
    implements List, Stream.Support, Files.Support, Origin.OnChange
{
    static desc(): IList {
        return {
            major: 'DLT',
            minor: 'Parsing DLT tracers',
            icon: undefined,
        };
    }

    static alias(): Protocol {
        return Protocol.Dlt;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            obj.getAsBool(configuration, 'with_storage_header');
            obj.getAsNotEmptyStringsArrayOrUndefined(configuration, 'fibex_file_paths');
            obj.getAsObjOrUndefined(configuration, 'filter_config');
            const filter_config = configuration.filter_config;
            if (filter_config !== undefined) {
                obj.getAsValidNumber(filter_config, 'min_log_level');
                obj.getAsNotEmptyStringsArrayOrUndefined(filter_config, 'app_ids');
                obj.getAsNotEmptyStringsArrayOrUndefined(filter_config, 'ecu_ids');
                obj.getAsNotEmptyStringsArrayOrUndefined(filter_config, 'context_ids');
                obj.getAsValidNumber(filter_config, 'app_id_count');
                obj.getAsValidNumber(filter_config, 'context_id_count');
            }
            return configuration;
        } catch (e) {
            return new Error(error(e));
        }
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return {
            filter_config: undefined,
            fibex_file_paths: [],
            with_storage_header: true,
        };
    }

    protected getDefaultsFilters(): IFilters {
        return {
            min_log_level: LogLevel.Verbose,
            app_ids: undefined,
            ecu_ids: undefined,
            context_ids: undefined,
            app_id_count: 0,
            context_id_count: 0,
        };
    }

    public onOriginChange(origin: Origin.Configuration): void {
        if (origin.instance instanceof Origin.Stream.Configuration) {
            this.configuration.with_storage_header = false;
        } else if (origin.instance instanceof Origin.File.Configuration) {
            this.configuration.with_storage_header =
                origin.instance.filetype() === Files.FileType.Binary;
        } else if (origin.instance instanceof Origin.Concat.Configuration) {
            // TODO: could be issue if concat configuration have different types
            // of files
            const types = origin.instance.filetypes();
            this.configuration.with_storage_header =
                types.length === 0 ? true : types[0] === Files.FileType.Binary;
        } else {
            throw new Error(`Not implemented usecase for DLT parser onOriginChange`);
        }
    }

    public desc(): IList {
        return Configuration.desc();
    }

    public setDefaultsFilterConfig(): void {
        if (this.configuration.filter_config !== undefined) {
            return;
        }
        this.configuration.filter_config = this.getDefaultsFilters();
    }

    public dropFilterConfigIfPossible(): void {
        if (this.configuration.filter_config === undefined) {
            return;
        }
        if (this.configuration.filter_config.min_log_level !== LogLevel.Verbose) {
            return;
        }
        if (
            this.configuration.filter_config.app_ids !== undefined &&
            this.configuration.filter_config.app_ids.length > 0
        ) {
            return;
        }
        if (
            this.configuration.filter_config.context_ids !== undefined &&
            this.configuration.filter_config.context_ids.length > 0
        ) {
            return;
        }
        if (
            this.configuration.filter_config.ecu_ids !== undefined &&
            this.configuration.filter_config.ecu_ids.length > 0
        ) {
            return;
        }
        this.configuration.filter_config = undefined;
    }

    public override hash(): number {
        const filters =
            this.configuration.filter_config === undefined
                ? this.getDefaultsFilters()
                : this.configuration.filter_config;
        return str.hash(
            `dlt:${(this.configuration.fibex_file_paths === undefined
                ? []
                : this.configuration.fibex_file_paths
            ).join(';')};${this.configuration.with_storage_header};${filters.min_log_level};${
                filters.ecu_ids?.length
            };${filters.app_ids?.length};${filters.context_ids?.length}`,
        );
    }
}
