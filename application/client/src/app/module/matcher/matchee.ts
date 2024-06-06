import * as wasm from '@loader/wasm';

export abstract class Matchee {
    private _index: number | undefined;
    private _matcher: wasm.Matcher;

    constructor(matcher: wasm.Matcher, item: object | undefined) {
        this._matcher = matcher;
        if (item !== undefined) {
            this._index = this._matcher.set_item(item);
        }
    }

    public getScore(): number {
        if (this._index === undefined) {
            return 0;
        }
        return Number(this._matcher.get_score(this._index));
    }

    protected setItem(item: object) {
        if (item !== undefined) {
            this._index = this._matcher.set_item(item);
        }
    }

    protected getHtmlOf(key: string): string | undefined {
        if (this._index === undefined) {
            return undefined;
        }
        return this._matcher.get_html_of(this._index, key);
    }
}

export abstract class PassiveMatchee {
    private _index: number | undefined;
    private _matcher: wasm.Matcher;

    constructor(matcher: wasm.Matcher) {
        this._matcher = matcher;
    }

    public abstract asObj(): object;

    public getScore(): number {
        if (this._index === undefined) {
            return 0;
        }
        return Number(this._matcher.get_score(this._index));
    }

    public setIndex(index: number) {
        this._index = index;
    }

    protected getHtmlOf(key: string): string | undefined {
        if (this._index === undefined) {
            return undefined;
        }
        return this._matcher.get_html_of(this._index, key);
    }
}

export function createPassiveMatcheeList<T extends PassiveMatchee>(
    list: T[],
    matcher: wasm.Matcher,
): T[] {
    const from: number = matcher.set_items(list.map((i) => i.asObj()));
    list.forEach((item, i) => {
        item.setIndex(from + i);
    });
    return list;
}
