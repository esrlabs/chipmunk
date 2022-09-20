import { Subject } from '../../env/subscription';
import { error } from '../../env/logger';

import * as obj from '../../env/obj';

export interface Entry {
    uuid: string;
    content: string;
}

export interface Recognizable {
    uuid(): string;
}

export abstract class EntryConvertable {
    public static from(str: string): Entry | Error {
        try {
            const parsed: unknown = JSON.parse(str);
            const entry: Entry = { uuid: '', content: '' };
            entry.uuid = obj.getAsNotEmptyString(parsed, 'uuid');
            entry.content = obj.getAsNotEmptyString(parsed, 'content');
            return entry;
        } catch (e) {
            return new Error(error(e));
        }
    }
    public static asStr(entry: Entry): string {
        return JSON.stringify(entry);
    }
    public abstract entry(): {
        to(): Entry;
        from(entry: Entry): Error | undefined;
        hash(): string;
        uuid(): string;
        updated(): Subject<void> | undefined;
    };
}
