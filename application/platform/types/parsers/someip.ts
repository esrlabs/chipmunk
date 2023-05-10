export interface ISomeIpOptions {
    dummy: string;
}
export interface SomeIpParserSettings {
    dummy: string;
}

export function optionsToParserSettings(options: ISomeIpOptions): SomeIpParserSettings {
    return {
        dummy: options.dummy,
    };
}
export function parserSettingsToOptions(options: SomeIpParserSettings): ISomeIpOptions {
    return {
        dummy: options.dummy,
    };
}
