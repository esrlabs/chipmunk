export interface PluginEntity {
    dir_path: string;
    plugin_type: PluginType;
    state: PluginState;
    metadata: PluginMetadata | null;
}

export enum PluginType {
    Parser = 'Parser',
    ByteSource = 'ByteSource',
}

export type PluginState =
    | { type: 'Active'; state: ActiveState }
    | { type: 'Invalid'; state: InvalidState };

export interface ActiveState {
    wasm_file_path: string;
    api_version: Version;
    plugin_version: Version;
    config_schemas: ConfigSchema[];
    render_options: RenderOptions;
}

export interface InvalidState {
    error_msg: string;
}

export interface Version {
    major: number;
    minor: number;
    patch: number;
}

export type ConfigSchemaType =
    | { type: 'Boolean' }
    | { type: 'Number' }
    | { type: 'Float' }
    | { type: 'Text' }
    | { type: 'Path' }
    | { type: 'Dropdown'; options: string[] };

export interface ConfigSchema {
    id: string;
    title: string;
    description: string;
    input_type: ConfigSchemaType;
}

export type RenderOptions =
    | { type: PluginType.Parser; options: ParserRenderOptions }
    | { type: PluginType.ByteSource };

export interface ParserRenderOptions {
    Parser: {
        headers: null;
    };
}

export interface PluginMetadata {
    name: string;
    description: string;
}
