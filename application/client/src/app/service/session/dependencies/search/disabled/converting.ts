import { Recognizable, Hash } from '@platform/types/storage/entry';
import { Json } from '@platform/types/storage/json';
import { Key } from '../store';
import { FilterRequest } from '../filters/request';

export interface DisableConvertable extends Recognizable, Json<FilterRequest>, Hash {
    disabled(): {
        displayName(): string;
        typeRef(): Key;
        icon(): string;
    };
}
