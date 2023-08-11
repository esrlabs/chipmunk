import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { UntypedFormControl } from '@angular/forms';
import { Entry, EntryConvertable } from '@platform/types/storage/entry';
import { error } from '@platform/log/utils';
import { Storage } from '@env/fsstorage';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Recent } from './item';

import * as wasm from '@loader/wasm';

@SetupLogger()
export class List extends Storage implements EntryConvertable {
    public items: Recent[] = [];
    public filter: string = '';
    public observer: Observable<Recent[]>;

    protected readonly control: UntypedFormControl;
    protected readonly matcher: wasm.Matcher = wasm.getMatcher().Matcher.new();
    protected readonly filealias: string;

    constructor(control: UntypedFormControl, name: string, filealias: string) {
        super();
        this.filealias = filealias;
        this.control = control;
        this.observer = control.valueChanges.pipe(
            startWith(''),
            map(() => []),
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
                this.assign();
            })
            .catch((err: Error) => {
                this.log().error(`Fail to load: ${err.message}`);
            });
    }

    public remove(recent: string) {
        this.items = this.items.filter((r) => r.value !== recent);
        this.assign();
        this.save();
    }

    public getStorageEntry(): Entry {
        return this.entry().to();
    }

    public getStorageKey(): string {
        return `${this.filealias}`;
    }

    public update(recent: string) {
        if (recent.trim() === '') {
            return;
        }
        const item = this.items.find((i) => i.value === recent);
        if (item === undefined) {
            this.items.push(new Recent(recent, this.matcher));
        } else {
            item.used += 1;
        }
        this.setFilter('');
        this.save();
    }

    public sort(items?: Recent[]) {
        (items === undefined ? this.items : items).sort((a, b) => {
            return a.used > b.used ? -1 : 1;
        });
    }

    public setFilter(filter: string) {
        this.matcher.search(filter);
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
                            const item = new Recent('', this.matcher);
                            const error = item.entry().from(r);
                            return error instanceof Error ? error : item;
                        })
                        .filter((r) => r instanceof Recent) as Recent[];
                    this.sort();
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

    protected save() {
        this.sort();
        this.storage()
            .save()
            .catch((err: Error) => {
                this.log().error(`Fail to save: ${err.message}`);
            });
    }

    protected assign(): void {
        this.observer = this.control.valueChanges.pipe(
            startWith(''),
            map((filter: string) => {
                this.setFilter(filter);
                const output = this.items.filter((i) => i.filtered);
                if (output.length === this.items.length) {
                    this.sort(output);
                }
                return output;
            }),
        );
    }
}
export interface List extends LoggerInterface {}
