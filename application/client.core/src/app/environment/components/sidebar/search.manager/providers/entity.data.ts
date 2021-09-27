import { Entity } from './entity';
import { DisabledRequest } from '../../../../controller/session/dependencies/search/dependencies/disabled/controller.session.tab.search.disabled';

export class EntityData<T> {
    private _entries: Entity<T>[] | undefined;
    private _disabled: Entity<DisabledRequest>[] | undefined;

    constructor(params: { entities?: Entity<T>[]; disabled?: Entity<DisabledRequest>[] }) {
        this._entries = params.entities instanceof Array ? params.entities : undefined;
        this._disabled = params.disabled instanceof Array ? params.disabled : undefined;
    }

    public get entries(): Entity<T>[] | undefined {
        return this._entries;
    }

    public get disabled(): Entity<DisabledRequest>[] | undefined {
        return this._disabled;
    }
}
