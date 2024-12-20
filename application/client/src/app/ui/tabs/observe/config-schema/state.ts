import { ConfigSchema, ConfigValue } from '@platform/types/plugins';

import { State as ParserState } from '../parsers/general/plugin/state';

export class State {
    private _parserState?: ParserState;

    public schemas: ConfigSchema[] = [];

    public reload(parent: ParserState) {
        this.schemas = parent.selectedParser?.state.Active?.config_schemas ?? [];
        this._parserState = parent;
    }

    public saveConfig(id: string, value: ConfigValue) {
        this._parserState?.saveConfig(id, value);
    }
}
