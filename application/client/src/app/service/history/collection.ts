import { Recognizable } from '@platform/types/storage/entry';
import { Equal } from '@platform/types/env/types';

import { Json, JsonField, JsonSet, Extractor } from '@platform/types/storage/json';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';

@SetupLogger()
export abstract class Collection<T extends Json<T> & Recognizable & Equal<T>> {
    abstract extractor(): Extractor<T>;
    abstract isSame(collection: Collection<T>): boolean;

    public elements: Map<string, T> = new Map();

    constructor(alias: string, entries: JsonSet) {
        this.setLoggerName(alias);
        this.load(entries);
    }

    protected extract(field: JsonField): T | Error | undefined {
        if (typeof field !== 'object' || field === null || field === undefined) {
            return new Error(`Invalid field`);
        }
        const json = field[this.extractor().key()];
        if (typeof json !== 'string') {
            return undefined;
        }
        return this.extractor().from(json);
    }

    public update(elements: T[]): void {
        this.elements.clear();
        elements.forEach((e) => {
            this.elements.set(e.uuid(), e);
        });
    }

    public load(entries: JsonSet) {
        this.elements.clear();
        entries.forEach((entry) => {
            const element = this.extract(entry);
            if (element instanceof Error) {
                this.log().warn(`Fail to extract value: ${element.message}`);
                return;
            }
            if (element === undefined) {
                return;
            }
            this.elements.set(element.uuid(), element);
        });
    }

    public as(): {
        jsonSet(): JsonSet;
        elements(): T[];
    } {
        return {
            jsonSet: (): JsonSet => {
                return Array.from(this.elements.values()).map((f) => {
                    return { [f.json().key()]: f.json().to() };
                });
            },
            elements: (): T[] => {
                return Array.from(this.elements.values());
            },
        };
    }
}
export interface Collection<T> extends LoggerInterface {}
