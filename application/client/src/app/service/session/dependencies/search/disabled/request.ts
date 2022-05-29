import { FilterRequest } from '../filters/request';
import { DisableConvertable } from './converting';
import { Recognizable } from '../recognizable';

export interface IDesc {
    type: string;
    desc: any;
}

export class DisabledRequest implements Recognizable {
    private _entity: DisableConvertable;
    private _uuid: string;

    constructor(entity: DisableConvertable & Recognizable) {
        let found: boolean = false;
        [FilterRequest].forEach((classRef) => {
            if (entity instanceof classRef) {
                found = true;
            }
        });
        if (!found) {
            throw new Error(`Fail to find a class for entity: ${typeof entity}`);
        }
        this._entity = entity;
        this._uuid = entity.uuid();
    }

    public uuid(): string {
        return this._uuid;
    }

    public entity(): DisableConvertable {
        return this._entity;
    }

    // public asDesc(): IDesc {
    //     return {
    //         type: this.getEntity().getTypeRef(),
    //         desc: this.getEntity().asDesc(),
    //     };
    // }

    // public remove(session: Session) {
    //     session.getSessionSearch().getDisabledAPI().getStorage().remove(this);
    // }
}
