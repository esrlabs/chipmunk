import { Recognizable } from '@platform/types/storage/entry';
import { error } from '@platform/log/utils';
import { Json } from '@platform/types/storage/json';
import { Equal } from '@platform/types/env/types';

import * as obj from '@platform/env/obj';

export class Bookmark extends Json<Bookmark> implements Recognizable, Equal<Bookmark> {
    public static KEY: string = 'bookmark';

    public static fromJson(json: string): Bookmark | Error {
        try {
            const def: { position: number } = JSON.parse(json);
            def.position = obj.getAsValidNumber(def, 'position');
            return new Bookmark(def.position);
        } catch (e) {
            return new Error(error(e));
        }
    }

    public readonly position: number;

    constructor(position?: number) {
        super();
        this.position = position === undefined ? -1 : position;
    }

    public uuid(): string {
        return this.position.toString();
    }

    public isSame(bookmark: Bookmark): boolean {
        return bookmark.position === this.position;
    }

    public json(): {
        to(): string;
        from(str: string): Bookmark | Error;
        key(): string;
    } {
        return {
            to: (): string => {
                return JSON.stringify({ position: this.position });
            },
            from: (json: string): Bookmark | Error => {
                return Bookmark.fromJson(json);
            },
            key: (): string => {
                return Bookmark.KEY;
            },
        };
    }
}
