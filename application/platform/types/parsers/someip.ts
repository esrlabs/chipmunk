export interface ISomeIpOptions {
    fibex: string[];
}
export interface SomeIpParserSettings {
    fibex_file_paths: string[] | undefined;
}

export function optionsToParserSettings(options: ISomeIpOptions): SomeIpParserSettings {
    return {
        fibex_file_paths: options.fibex.length > 0 ? options.fibex : undefined,
    };
}
export function parserSettingsToOptions(options: SomeIpParserSettings): ISomeIpOptions {
    return {
        fibex: options.fibex_file_paths === undefined ? [] : options.fibex_file_paths,
    };
}

export interface SomeipStatistic {
    /** Statistic on service-ids and related method-ids */
    services: SomeipStatisticItem[];
    /** Statistic on message-types and related return-codes */
    messages: SomeipStatisticItem[];
}

export interface SomeipStatisticItem {
    item: SomeipStatisticDetail;
    details: SomeipStatisticDetail[];
}

export interface SomeipStatisticDetail {
    id: number;
    num: number;
}
