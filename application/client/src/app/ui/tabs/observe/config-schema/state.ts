import {
    PluginConfigSchemaItem,
    PluginConfigSchemaType,
    PluginConfigValue,
} from '@platform/types/bindings/plugins';

import { State as ParserState } from '../parsers/general/plugin/state';

export class State {
    private _parserState?: ParserState;

    public schemas: PluginConfigSchemaItem[] = [];

    public reload(parent: ParserState) {
        const state = parent.selectedParser?.state;
        this.schemas = state && 'Active' in state ? state.Active.config_schemas : [];
        this._parserState = parent;
    }

    public saveConfig(id: string, value: PluginConfigValue) {
        this._parserState?.saveConfig(id, value);
    }

    public isBooleanItem(schema: PluginConfigSchemaType): schema is { Boolean: boolean } {
        return typeof schema === 'object' && 'Boolean' in schema;
    }

    public isIntegerItem(schema: PluginConfigSchemaType): schema is { Integer: number } {
        return typeof schema === 'object' && 'Integer' in schema;
    }

    public isFloatItem(schema: PluginConfigSchemaType): schema is { Float: number } {
        return typeof schema === 'object' && 'Float' in schema;
    }

    public isTextItem(schema: PluginConfigSchemaType): schema is { Text: string } {
        return typeof schema === 'object' && 'Text' in schema;
    }

    public isDirectoriesItem(schema: PluginConfigSchemaType): schema is 'Directories' {
        return schema === 'Directories';
    }

    public isDropdownItem(
        schema: PluginConfigSchemaType,
    ): schema is { Dropdown: [Array<string>, string] } {
        return typeof schema === 'object' && 'Dropdown' in schema;
    }

    public isFilesPicker(schema: PluginConfigSchemaType): schema is { Files: Array<string> } {
        return typeof schema === 'object' && 'Files' in schema;
    }
}
