import { EntityEditState } from './entity.state.edit';

import * as Toolkit from 'chipmunk.client.toolkit';

export class Entity<T> {
    private _guid: string;
    private _entity: T;
    private _editState: EntityEditState = new EntityEditState();

    constructor(entity: T, guid?: string) {
        this._entity = entity;
        this._guid = guid === undefined ? Toolkit.guid() : guid;
    }

    public getGUID(): string {
        return this._guid;
    }

    public getEntity(): T {
        return this._entity;
    }

    public setEntity(entity: T) {
        this._entity = entity;
    }

    public getEditState(): EntityEditState {
        return this._editState;
    }
}
