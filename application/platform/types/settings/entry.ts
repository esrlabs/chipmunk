import { Storage } from '../storage/storage';
import { Record } from '../storage/storage.record';
import { Description, IDescription } from './entry.description';

export interface ISettingsEntry {
    value: string | number | boolean | undefined;
    desc: IDescription;
}

export class Entry<T extends string | number | boolean | undefined> {
    public readonly value: Record<T>;
    public readonly desc: Description;

    constructor(desc: Description, value: Record<T>) {
        this.desc = desc;
        this.value = value.locate(desc.path, desc.key);
    }

    public bind(storage: Storage): Error | undefined {
        const error = this.value.bind(storage);
        if (error instanceof Error) {
            return error;
        }
        return this.value.read();
    }

    public asObj(): ISettingsEntry {
        return {
            value: this.value.get(),
            desc: this.desc.asObj(),
        };
    }
}
