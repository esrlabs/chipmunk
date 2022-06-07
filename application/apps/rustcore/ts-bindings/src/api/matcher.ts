import { getNativeModule } from '../native/native';
import { RustMatcher, TSorted } from '../native/native.matcher';

export class Matcher {
    private readonly _native: RustMatcher;

    constructor() {
        this._native = new (getNativeModule().RustMatcher)();
    }

    public set_items(items: TSorted): void {
        this._native.setItems(items);
    }

    public search(query: string, keep_zero_score: boolean, tag: string): TSorted | Error {
        let result: string | TSorted = this._native.search(query, keep_zero_score, tag);
        return typeof result !== 'string' ? result : new Error(result);
    }
}
