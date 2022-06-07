export type TSorted = string[][][];

export abstract class RustMatcher {
    public abstract setItems(items: TSorted): void;

    public abstract search(query: string, keep_zero_score: boolean, tag: string): TSorted | string;
}
