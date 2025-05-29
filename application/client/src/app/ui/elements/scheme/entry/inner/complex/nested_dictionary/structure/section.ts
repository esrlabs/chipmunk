import { Subject } from '@platform/env/subscription';
import { DictionaryEntities } from './statentity';

export class Section {
    public key: string;
    public name: string;
    public update: Subject<void> = new Subject();
    public entities: DictionaryEntities[] = [];

    constructor(key: string, name: string) {
        this.key = key;
        this.name = name;
    }

    public getSelected(): DictionaryEntities[] {
        return this.entities.filter((f) => f.selected);
    }

    public fill(entities: DictionaryEntities[]): Section {
        this.entities = entities;
        return this;
    }

    public keys(): string[] {
        return this.entities.length > 0 ? this.entities[0].keys() : [];
    }
}
