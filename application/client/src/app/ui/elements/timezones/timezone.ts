import * as regex from '@platform/env/regex';

export class Timezone {
    public readonly name: string;
    public readonly utc: string;
    public readonly offset: number;
    public hidden: boolean = false;

    private _filter: string = '';

    constructor(name: string, utc: string, offset: number) {
        this.name = name;
        this.utc = utc;
        this.offset = offset;
    }

    public getNameAsHtml(): string {
        if (this._filter === '') {
            return this.name;
        }
        const reg = regex.fromStr(this._filter);
        if (reg instanceof Error) {
            return this.name;
        }
        return this.name.replace(reg, (match, _p1, _p2, _p3, _offset, _string): string => {
            return `<span>${match}</span>`;
        });
    }

    public getUtcAsHtml(): string {
        if (this._filter === '') {
            return this.utc;
        }
        const reg = regex.fromStr(this._filter);
        if (reg instanceof Error) {
            return this.utc;
        }
        return this.utc.replace(reg, (match, _p1, _p2, _p3, _offset, _string): string => {
            return `<span>${match}</span>`;
        });
    }

    public filter(filter: string) {
        this._filter = filter.trim();
        this.hidden =
        this._filter === ''
                ? false
                : (this.name.toLowerCase().indexOf(filter) === -1 &&
                  this.utc.toLowerCase().indexOf(filter) === -1);
    }
}
