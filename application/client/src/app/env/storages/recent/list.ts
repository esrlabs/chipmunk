import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { Entry, EntryConvertable } from '@platform/types/storage/entry';
import { error } from '@platform/env/logger';
import { Storage } from '@env/fsstorage';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Matcher } from '@matcher/matcher';
import { Recent } from './item';

@SetupLogger()
export class List extends Storage implements EntryConvertable {
    public items: Recent[] = [];
    public filter: string = '';
    public observer: Observable<Recent[]>;

    private _matcher: Matcher = Matcher.new();
    private _filealias: string;

    constructor(control: FormControl, name: string, filealias: string) {
        super();
        this._filealias = filealias;
        this.observer = control.valueChanges.pipe(
            startWith(''),
            map((filter: string) => {
                this.setFilter(filter);
                return this.items.filter((i) => i.filtered);
            }),
        );
        this.setLoggerName(name);
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
        return `${this._filealias}`;
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
