export { DltFilterConf, LevelDistribution, StatisticInfo, DltLogLevel, IIndexDltParams } from '../../apps/indexer-neon/dist/dlt';

export interface IDLTFilters {
    [key: string]: string[];
}

export interface IDLTOptions {
    logLevel: number;
    filters: IDLTFilters;
    fibexFilePath?: string;
}
