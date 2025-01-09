import { PluginConfigSchemaItem, PluginConfigValue } from '@platform/types/bindings/plugins';

import { State as ParserState } from '../parsers/general/plugin/state';

export class State {
    private _parserState?: ParserState;

    public schemas: PluginConfigSchemaItem[] = [];

    public reload(parent: ParserState) {
        this.schemas =
            parent.selectedParser?.state.state === 'Active'
                ? parent.selectedParser.state.info.config_schemas
                : [];
        this._parserState = parent;
    }

    public saveConfig(id: string, value: PluginConfigValue) {
        this._parserState?.saveConfig(id, value);
    }
}
