import { PluginConfigSchemaItem, PluginConfigValue } from '@platform/types/bindings/plugins';

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
}
