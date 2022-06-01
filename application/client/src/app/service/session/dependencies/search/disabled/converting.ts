import { Recognizable } from '../recognizable';
import { EntryConvertable } from '@platform/types/storage/entry';
import { Key } from '../store';

export interface DisableConvertable extends Recognizable, EntryConvertable {
    disabled(): {
        displayName(): string;
        typeRef(): Key;
        icon(): string;
    };
}
