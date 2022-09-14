import { Subject } from '@platform/env/subscription';
import { StatEntity } from './statentity';

export class Section {
    public key: string;
    public name: string;
    public update: Subject<void> = new Subject();
    public entities: StatEntity[] = [];

    constructor(key: string, name: string) {
        this.key = key;
        this.name = name;
    }

    public getSelected(): StatEntity[] {
        return this.entities.filter((f) => f.selected);
    }

    public fill(entities: StatEntity[]): Section {
        this.entities = entities;
        return this;
    }
}
