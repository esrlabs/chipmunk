import { bridge } from '@service/bridge';
import { Collections } from './collections';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { error } from '@platform/env/logger';
import { Definition } from './definition';

@SetupLogger()
export class StorageCollections {
    static UUID = 'history_collections_storage';
    protected collections: Map<string, Collections> = new Map();

    constructor() {
        this.setLoggerName(`StorageCollections`);
    }

    public async load(): Promise<void> {
        this.collections.clear();
        await bridge
            .entries(StorageCollections.UUID)
            .get()
            .then((entries) => {
                entries.forEach((entry) => {
                    try {
                        const collections = Collections.from(entry);
                        this.collections.set(collections.uuid, collections);
                    } catch (e) {
                        this.log().error(`Fail parse collection: ${error(e)}`);
                    }
                });
            })
            .catch((err: Error) => {
                this.log().warn(`Fail to read history collections: ${err.message}`);
            });
    }

    public async save(): Promise<void> {
        await bridge
            .entries(StorageCollections.UUID)
            .update(Array.from(this.collections.values()).map((c) => c.entry().to()))
            .catch((err: Error) => {
                this.log().warn(`Fail to write history collections: ${err.message}`);
            });
    }

    public update(collections: Collections): string | undefined {
        const existed = Array.from(this.collections.values()).find((c) => c.isSame(collections));
        if (this.collections.has(collections.uuid) || existed === undefined) {
            this.collections.set(collections.uuid, collections);
            return undefined;
        }
        return existed.uuid;
    }

    public find(definitions: Definition[]): Collections[] {
        return Array.from(this.collections.values()).filter((collections) => {
            return definitions.filter((def) => collections.relations.indexOf(def.uuid) !== -1);
        });
    }
}
export interface StorageCollections extends LoggerInterface {}
