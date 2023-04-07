import { bridge } from '@service/bridge';
import { Definition } from './definition';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { error } from '@platform/log/utils';

@SetupLogger()
export class StorageDefinitions {
    static UUID = 'history_definitions_storage';
    protected definitions: Map<string, Definition> = new Map();

    constructor() {
        this.setLoggerName(`StorageDefinitions`);
    }

    public async load(): Promise<void> {
        this.definitions.clear();
        await bridge
            .entries({ key: StorageDefinitions.UUID })
            .get()
            .then((entries) => {
                entries.forEach((entry) => {
                    try {
                        const definition = Definition.from(entry);
                        this.definitions.set(definition.uuid, definition);
                    } catch (e) {
                        this.log().error(`Fail parse definition: ${error(e)}`);
                    }
                });
            })
            .catch((err: Error) => {
                this.log().warn(`Fail to read history definition: ${err.message}`);
            });
    }

    public async save(): Promise<void> {
        await bridge
            .entries({ key: StorageDefinitions.UUID })
            .update(Array.from(this.definitions.values()).map((d) => d.entry().to()))
            .catch((err: Error) => {
                this.log().warn(`Fail to write history definition: ${err.message}`);
            });
    }

    public update(definition: Definition): Definition {
        const existed = Array.from(this.definitions.values()).find((d) => d.isSame(definition));
        if (existed === undefined) {
            this.definitions.set(definition.uuid, definition);
            return definition;
        }
        return existed;
    }

    public add(definitions: Definition[]): void {
        definitions.forEach((def) => this.update(def));
        this.save();
    }

    public get(uuid: string): Definition | undefined {
        return this.definitions.get(uuid);
    }
}
export interface StorageDefinitions extends LoggerInterface {}
