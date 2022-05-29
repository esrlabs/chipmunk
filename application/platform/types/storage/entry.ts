export interface Entry {
    uuid: string;
    content: string;
}

export abstract class EntryConvertable {
    public abstract entry(): {
        to(): Entry;
        from(entry: Entry): Error | undefined;
        hash(): string;
        uuid(): string;
    };
}
