import { FilterRequest } from '../filters/request';
import { ChartRequest } from '../charts/request';
import { DisableConvertable } from './converting';
import { Hash, Recognizable } from '@platform/types/storage/entry';
import { Key } from '../store';
import { error } from '@platform/env/logger';
import { Json } from '@platform/types/storage/json';
import { Equal } from '@platform/types/env/types';
import { Updatable } from '../store';
import { Subject } from '@platform/env/subscription';

export interface IDesc {
    type: string;
    desc: any;
}

export class DisabledRequest
    extends Json<DisabledRequest>
    implements Recognizable, Hash, Equal<DisabledRequest>, Updatable<void>
{
    public static KEY: Key = Key.disabled;
    public static fromJson(json: string): DisabledRequest | Error {
        try {
            const def: {
                key: Key;
                value: string;
            } = JSON.parse(json);
            let entity;
            if (def.key === Key.filters) {
                entity = FilterRequest.fromJson(def.value);
                if (entity instanceof Error) {
                    return entity;
                }
                return new DisabledRequest(entity);
            } else if (def.key === Key.charts) {
                entity = ChartRequest.fromJson(def.value);
                if (entity instanceof Error) {
                    return entity;
                }
                return new DisabledRequest(entity);
            } else {
                return new Error(`Unsupportable content for Disabled; key = ${def.key}`);
            }
        } catch (e) {
            return new Error(error(e));
        }
    }
    private _entity: DisableConvertable;
    private _key: Key;
    public readonly updated: Subject<void> | undefined;

    constructor(entity: DisableConvertable) {
        super();
        let key: Key | undefined;
        [FilterRequest, ChartRequest].forEach((classRef) => {
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

    public isSame(disabled: DisabledRequest): boolean {
        const getFilterHash = (f: FilterRequest) => {
            return `${f.definition.filter.filter}|${f.definition.filter.flags.cases}|${f.definition.filter.flags.reg}|${f.definition.filter.flags.word}`;
        };
        const left = disabled.entity();
        const right = this.entity();
        if (left instanceof FilterRequest && right instanceof FilterRequest) {
            return getFilterHash(left) === getFilterHash(right);
        }
        if (left instanceof ChartRequest && right instanceof ChartRequest) {
            return left.definition.filter === right.definition.filter;
        }
        return false;
    }

    public uuid(): string {
        return this._entity.uuid();
    }

    public entity(): DisableConvertable {
        return this._entity;
    }

    public as(): {
        filter(): FilterRequest | undefined;
        chart(): ChartRequest | undefined;
    } {
        return {
            filter: (): FilterRequest | undefined => {
                return this._entity instanceof FilterRequest ? this._entity : undefined;
            },
            chart: (): ChartRequest | undefined => {
                return this._entity instanceof ChartRequest ? this._entity : undefined;
            },
        };
    }

    public json(): {
        to(): string;
        from(str: string): DisabledRequest | Error;
        key(): string;
    } {
        return {
            to: (): string => {
                return JSON.stringify({
                    key: this._key,
                    value: this._entity.json().to(),
                });
            },
            from: (json: string): DisabledRequest | Error => {
                return DisabledRequest.fromJson(json);
            },
            key: (): string => {
                return DisabledRequest.KEY;
            },
        };
    }

    public hash(): string {
        return this._entity.hash();
    }
}
