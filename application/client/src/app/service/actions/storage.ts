import { EntryConvertable, Entry } from '@platform/types/storage/entry';
import { Subject } from '@platform/env/subscription';
import { error } from '@platform/log/utils';
import { bridge } from '@service/bridge';
import { getActionByUuid, Base } from './index';

import * as obj from '@platform/env/obj';

export class Storage extends EntryConvertable {
    static STORAGE_KEY = 'pinned_actions';
    static ENTITY_UUID = 'actions';

    public pinned: string[] = [];
    public updated: Subject<void> = new Subject();

    public destroy() {
        this.updated.destroy();
    }

    public isPinned(uuid: string): boolean {
        return this.pinned.includes(uuid);
    }

    public get(): Base[] {
        return this.pinned
            .map((uuid) => getActionByUuid(uuid))
            .filter((i) => i !== undefined) as Base[];
    }

    public toggle(uuid: string) {
        const index = this.pinned.indexOf(uuid);
        if (index === -1) {
            this.pinned.push(uuid);
        } else {
            this.pinned.splice(index, 1);
        }
        this.save();
        this.updated.emit();
    }

    public load() {
        bridge
            .entries({ key: Storage.STORAGE_KEY })
            .get()
            .then((entry: Entry[]) => {
                if (entry.length !== 1) {
                    return;
                }
                const error = this.entry().from(entry[0]);
                if (error instanceof Error) {
                    console.error(error);
                } else {
                    this.updated.emit();
                }
            })
            .catch((err: Error) => {
                console.error(err);
            });
    }

    public save() {
        bridge
            .entries({ key: Storage.STORAGE_KEY })
            .overwrite([this.entry().to()])
            .catch((err: Error) => {
                console.error(err);
            });
    }

    public entry(): {
        to(): Entry;
        from(entry: Entry): Error | undefined;
        hash(): string;
        uuid(): string;
        updated(): Subject<void> | undefined;
    } {
        return {
            to: (): Entry => {
                return {
                    uuid: Storage.ENTITY_UUID,
                    content: JSON.stringify({
                        value: this.pinned,
                        used: 0,
                    }),
                };
            },
            from: (entry: Entry): Error | undefined => {
                try {
                    const def: {
                        value: string;
                        used: number;
                    } = JSON.parse(entry.content);
                    this.pinned = obj.getAsArray(def, 'value');
                } catch (e) {
                    return new Error(error(e));
                }
                return undefined;
            },
            hash: (): string => {
                return this.pinned.join(',');
            },
            uuid: (): string => {
                return Storage.ENTITY_UUID;
            },
            updated: (): undefined => {
                return undefined;
            },
        };
    }
}
