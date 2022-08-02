import { SafeHtml } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { getDomSanitizer } from '@ui/env/globals';
import { Entry, EntryConvertable } from '@platform/types/storage/entry';
import { error } from '@platform/env/logger';
import { Storage } from '@env/fsstorage';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Matcher } from '@matcher/matcher';
import { Matchee } from '@module/matcher';

import * as obj from '@platform/env/obj';

export class Recent extends Matchee implements EntryConvertable {
    public value: string = '';
    public used: number = 0;

    private _htmlValue: string = '';

    constructor(value: string, matcher: Matcher) {
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

@SetupLogger()
export class List extends Storage implements EntryConvertable {
    static RECENT_ENTRY_UUID = 'recent_terminal_commands';
    public items: Recent[] = [];
    public filter: string = '';
    public observer: Observable<Recent[]>;

    private _matcher: Matcher = Matcher.new();
    private _parent: string;

    constructor(control: FormControl, parent: string) {
        super();
        this._parent = parent;
        this.observer = control.valueChanges.pipe(
            startWith(''),
            map((filter: string) => {
                this.setFilter(filter);
                return this.items.filter((i) => i.filtered);
            }),
        );
        this.setLoggerName(`RecentCommandsList`);
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
        return `${List.RECENT_ENTRY_UUID}_${this._parent}`;
    }

    public update(recent: string) {
        const item = this.items.find((i) => i.value === recent);
        if (item === undefined) {
            this.items.push(new Recent(recent, this._matcher));
        } else {
            item.used += 1;
        }
        this.setFilter('');
        this.storage()
            .save()
            .catch((err: Error) => {
                this.log().error(`Fail to save: ${err.message}`);
            });
    }

    public setFilter(filter: string) {
        this._matcher.search(filter);
        this.items.sort((a: Recent, b: Recent) => b.getScore() - a.getScore());
        this.items.forEach((i) => i.setFilter());
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
                    uuid: this.getStorageKey(),
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
                            const item = new Recent('', this._matcher);
                            const error = item.entry().from(r);
                            return error instanceof Error ? error : item;
                        })
                        .filter((r) => r instanceof Recent) as Recent[];
                } catch (e) {
                    return new Error(error(e));
                }
                return undefined;
            },
            hash: (): string => {
                return this.items.map((r) => r.entry().hash()).join(';');
            },
            uuid: (): string => {
                return this.getStorageKey();
            },
            updated: (): undefined => {
                return undefined;
            },
        };
    }
}
export interface List extends LoggerInterface {}
