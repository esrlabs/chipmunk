import { error } from '../../../../log/utils';
import { Protocol } from '../index';
import { Configuration as Base, ConfigurationStaticDesc } from '../../configuration';
import { Statics } from '../../../../env/decorators';
import { List, IList } from '../../description';

import * as Stream from '../../origin/stream/index';
import * as Files from '../../types/file';
import * as obj from '../../../../env/obj';

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

export interface StatisticInfo {
    app_ids: [string, LevelDistribution][];
    context_ids: [string, LevelDistribution][];
    ecu_ids: [string, LevelDistribution][];
    contained_non_verbose: boolean;
}

export enum LogLevel {
    Fatal = 0x1 << 4,
    Error = 0x2 << 4,
    Warn = 0x3 << 4,
    Info = 0x4 << 4,
    Debug = 0x5 << 4,
    Verbose = 0x6 << 4,
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
    implements List, Stream.Support, Files.Support
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

    public desc(): IList {
        return Configuration.desc();
    }
}
