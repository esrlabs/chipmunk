import { SafeHtml } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { getDomSanitizer, getMatcher } from '@ui/env/globals';
import { Entry, EntryConvertable } from '@platform/types/storage/entry';
import { error } from '@platform/env/logger';
import { Storage } from '@env/fsstorage';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';

import * as obj from '@platform/env/obj';

export class Recent implements EntryConvertable {
    public value: string = '';
    public used: number = 0;

    private _htmlValue: string = '';
    private _filtered: boolean = false;

    constructor(value: string) {
        this.value = value;
    }

    public html(): SafeHtml {
        return getDomSanitizer().bypassSecurityTrustHtml(this._htmlValue);
    }

    public setFilter(filter: string) {
        this._htmlValue = getMatcher().search_single(filter, this.value);
        this._filtered = this._htmlValue !== this.value;
    }

    public get filtered(): boolean {
        return this._filtered;
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
                        filter: this.value,
                        used: this.used,
                    }),
                };
            },
            from: (entry: Entry): Error | undefined => {
                try {
                    const def: {
                        filter: string;
                        used: number;
                    } = JSON.parse(entry.content);
                    this.value = obj.getAsNotEmptyString(def, 'filter');
                    this.used = obj.getAsValidNumber(def, 'used');
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

@SetupLogger()
export class RecentList extends Storage implements EntryConvertable {
    static RECENT_ENTRY_UUID = 'recent_filters';
    public items: Recent[] = [];
    public filter: string = '';
    public observer: Observable<Recent[]>;

    constructor(control: FormControl) {
        super();
        this.observer = control.valueChanges.pipe(
            startWith(''),
            map((filter: string) => {
                this.setFilter(filter);
                return this.items.filter((i) => i.filtered);
            }),
        );
        this.setLoggerName(`RecentList`);
        this.storage()
            .load()
            .then((entry: Entry | undefined) => {
                if (entry === undefined) {
                    return;
                }
                const error = this.entry().from(entry);
                if (error instanceof Error) {
                    this.log().error(`Fail to parse loaded content: ${error.message}`);
                }
            })
            .catch((err: Error) => {
                this.log().error(`Fail to load: ${err.message}`);
            });
    }

    public getStorageEntry(): Entry {
        return this.entry().to();
    }

    public getStorageKey(): string {
        return RecentList.RECENT_ENTRY_UUID;
    }

    public update(recent: string) {
        const item = this.items.find((i) => i.value === recent);
        if (item === undefined) {
            this.items.push(new Recent(recent));
        } else {
            item.used += 1;
        }
        this.setFilter('');
        this.items.sort((a, b) => {
            return a.used < b.used ? 1 : -1;
        });
        this.storage()
            .save()
            .catch((err: Error) => {
                this.log().error(`Fail to save: ${err.message}`);
            });
    }

    public setFilter(filter: string) {
        this.items.forEach((i) => i.setFilter(filter));
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
                    uuid: RecentList.RECENT_ENTRY_UUID,
                    content: JSON.stringify(this.items.map((r) => r.entry().to())),
                };
            },
            from: (entry: Entry): Error | undefined => {
                try {
                    const recent = JSON.parse(entry.content);
                    if (!(recent instanceof Array)) {
                        throw new Error(
                            `Expecting to get an array of recent. Gotten: ${typeof recent} (${recent})`,
                        );
                    }
                    this.items = recent
                        .map((r) => {
                            const item = new Recent('');
                            const error = item.entry().from(r);
                            return error instanceof Error ? error : item;
                        })
                        .filter((r) => r instanceof Recent) as Recent[];
                    this.items.sort((a, b) => {
                        return a.used < b.used ? 1 : -1;
                    });
                } catch (e) {
                    return new Error(error(e));
                }
                return undefined;
            },
            hash: (): string => {
                return this.items.map((r) => r.entry().hash()).join(';');
            },
            uuid: (): string => {
                return RecentList.RECENT_ENTRY_UUID;
            },
            updated: (): undefined => {
                return undefined;
            },
        };
    }
}
export interface RecentList extends LoggerInterface {}
