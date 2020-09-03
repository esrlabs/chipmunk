import { Entity } from './entity';
import { DisabledRequest } from '../../../../controller/controller.session.tab.search.disabled';

interface IDisabledData { disabled: Entity<DisabledRequest>[]; }

export class EntityData<T> {

    private _entries: Entity<T>[];
    private _disabled: Entity<DisabledRequest>[];

    constructor(entries: Entity<T>[] | IDisabledData) {
        if (entries instanceof Array) {
            this._entries = entries;
        } else if (entries.disabled instanceof Array) {
            this._disabled = entries.disabled;
        }
    }

    public get entries(): Entity<T>[] | undefined {
        return this._entries;
    }

    public get disabled(): Entity<DisabledRequest>[] | undefined {
        return this._disabled;
    }

}
