import { FilterRequest } from '../filters/request';
import { DisableConvertable } from './converting';
import { Recognizable } from '../declarations/recognizable';
import { EntryConvertable, Entry } from '@platform/types/storage/entry';
import { Key } from '../store';
import { error } from '@platform/env/logger';

export interface IDesc {
    type: string;
    desc: any;
}

export class DisabledRequest implements Recognizable, EntryConvertable {
    public static KEY: Key = Key.disabled;

    private _entity: DisableConvertable;
    private _key: Key;

    constructor(entity: DisableConvertable) {
        let key: Key | undefined;
        [FilterRequest].forEach((classRef) => {
            if (key !== undefined) {
                return;
            }
            if (entity instanceof classRef) {
                key = classRef.KEY;
            }
        });
        if (key === undefined) {
            throw new Error(`Fail to find a class for entity: ${typeof entity}`);
        }
        this._entity = entity;
        this._key = key;
    }

    public uuid(): string {
        return this._entity.uuid();
    }

    public entity(): DisableConvertable {
        return this._entity;
    }

    public entry(): {
        to(): Entry;
        from(entry: Entry): Error | undefined;
        hash(): string;
        uuid(): string;
        updated(): undefined;
    } {
        return {
            to: (): Entry => {
                return {
                    uuid: this._entity.uuid(),
                    content: JSON.stringify({
                        key: this._key,
                        value: this._entity.entry().to(),
                    }),
                };
            },
            from: (entry: Entry): Error | undefined => {
                try {
                    const def: {
                        key: Key;
                        value: string;
                    } = JSON.parse(entry.content);
                    let entity;
                    if (def.key === Key.filters) {
                        entity = FilterRequest.from(entry.content);
                        if (entity instanceof Error) {
                            return entity;
                        }
                        this._entity = entity;
                    }
                } catch (e) {
                    return new Error(error(e));
                }
                return undefined;
            },
            hash: (): string => {
                return this._entity.entry().hash();
            },
            uuid: (): string => {
                return this._entity.uuid();
            },
            updated: (): undefined => {
                return undefined;
            },
        };
    }
}
