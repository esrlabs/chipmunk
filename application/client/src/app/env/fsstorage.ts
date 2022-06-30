import { bridge } from '@service/bridge';
import { Entry, EntryConvertable } from '@platform/types/storage/entry';

export abstract class Storage {
    public abstract getStorageKey(): string;
    public abstract getStorageEntry(): Entry;

    public storage(): {
        save(): Promise<void>;
        load(): Promise<Entry | undefined>;
    } {
        return {
            save: (): Promise<void> => {
                return bridge
                    .storage(this.getStorageKey())
                    .write(EntryConvertable.asStr(this.getStorageEntry()));
            },
            load: (): Promise<Entry | undefined> => {
                return new Promise((resolve, reject) => {
                    bridge
                        .storage(this.getStorageKey())
                        .read()
                        .then((content: string) => {
                            if (content.trim() === '') {
                                return resolve(undefined);
                            }
                            const entry = EntryConvertable.from(content);
                            if (entry instanceof Error) {
                                return reject(entry);
                            }
                            resolve(entry);
                        })
                        .catch(reject);
                });
            },
        };
    }
}
