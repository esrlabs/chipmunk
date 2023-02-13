import { Recognizable, Hash } from '@platform/types/storage/entry';
import { Json } from '@platform/types/storage/json';
import { Key } from '../store';
import { FilterRequest } from '../filters/request';
import { ChartRequest } from '../charts/request';

export interface DisableConvertable extends Recognizable, Json<FilterRequest | ChartRequest>, Hash {
    disabled(): {
        displayName(): string;
        typeRef(): Key;
        icon(): string;
    };
}
