import { Recognizable } from '@platform/types/storage/entry';
import { Equal } from '@platform/types/env/types';
import { Session } from '@service/session/session';
import { Json, JsonField, JsonSet, Extractor } from '@platform/types/storage/json';
import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Definition } from './definition';
import { Subscriber, Subject } from '@platform/env/subscription';

export type AfterApplyCallback = () => void;
@SetupLogger()
export abstract class Collection<T extends Json<T> & Recognizable & Equal<T>> {
    abstract subscribe(subscriber: Subscriber, session: Session): void;
    abstract extractor(): Extractor<T>;
    abstract isSame(collection: Collection<T>): boolean;
    abstract applyTo(session: Session, definitions: Definition[]): Promise<AfterApplyCallback>;
    abstract applicableOnlyToOrigin(): boolean;

    public readonly elements: Map<string, T> = new Map();
    public readonly updated: Subject<void> = new Subject();

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
export interface Collection<T> extends LoggerInterface {
    _phantom: T;
}
