import { SafeHtml } from '@angular/platform-browser';
import { getDomSanitizer } from '@ui/env/globals';
import { Entry, EntryConvertable } from '@platform/types/storage/entry';
import { error } from '@platform/log/utils';
import { Matchee } from '@module/matcher';

import * as obj from '@platform/env/obj';
import * as wasm from '@loader/wasm';

export class Recent extends Matchee implements EntryConvertable {
    public value: string = '';
    public used: number = 0;

    private _htmlValue: string = '';

    constructor(value: string, matcher: wasm.Matcher) {
        super(matcher, value !== '' ? { value: value } : undefined);
        this.value = value;
    }

    public html(): SafeHtml {
        return getDomSanitizer().bypassSecurityTrustHtml(this._htmlValue);
    }

    public setFilter() {
        const value: string | undefined = this.getHtmlOf('html_value');
        this._htmlValue = value === undefined ? this.value : value;
    }

    public get filtered(): boolean {
        return this.getScore() > 0;
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
                    uuid: this.value,
                    content: JSON.stringify({
                        value: this.value,
                        used: this.used,
                    }),
                };
            },
            from: (entry: Entry): Error | undefined => {
                try {
                    const def: {
                        value: string;
                        used: number;
                    } = JSON.parse(entry.content);
                    this.value = obj.getAsNotEmptyString(def, 'value');
                    this.used = obj.getAsValidNumber(def, 'used');
                    this.setItem({ value: this.value });
                } catch (e) {
                    return new Error(error(e));
                }
                return undefined;
            },
            hash: (): string => {
                return `${this.value}/${this.used}`;
            },
            uuid: (): string => {
                return this.value;
            },
            updated: (): undefined => {
                return undefined;
            },
        };
    }
}
