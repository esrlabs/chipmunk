import { Matcher } from '@matcher/matcher';

export abstract class Matchee {
    private _index: number | undefined;
    private _matcher: Matcher;

    constructor(matcher: Matcher, item: object | undefined) {
        this._matcher = matcher;
        if (item !== undefined) {
            this._index = this._matcher.set_item(JSON.stringify(item));
        }
    }

    public getScore(): number {
        if (this._index === undefined) {
            return 0;
        }
        return Number(this._matcher.get_score(this._index));
    }

    protected setItem(item: object) {
        this._index = this._matcher.set_item(JSON.stringify(item));
    }

    protected getHtmlOf(key: string): string | undefined {
        if (this._index === undefined) {
            return undefined;
        }
        return this._matcher.get_html_of(this._index, key);
    }
}
