export interface ISomeIpOptions {
    fibex: string[];
}
export interface SomeIpParserSettings {
    fibex_file_paths: Array<string> | undefined;
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
