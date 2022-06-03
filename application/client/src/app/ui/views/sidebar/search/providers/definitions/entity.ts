import { EntityEditState } from './entity.state.edit';
import { Recognizable } from '@service/session/dependencies/search/declarations/recognizable';

export class Entity<T> {
    private _entity: T & Recognizable;
    private _editState: EntityEditState = new EntityEditState();

    constructor(entity: T & Recognizable) {
        this._entity = entity;
    }

    public uuid(): string {
        return this._entity.uuid();
    }

    public extract(): T & Recognizable {
        return this._entity;
    }

    public set(entity: T & Recognizable) {
        this._entity = entity;
    }

    public getEditState(): EntityEditState {
        return this._editState;
    }
}
