import * as moment_timezone from 'moment-timezone';
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

    static from(tz: string): Timezone {
        const now = new Date();
        const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth());
        const zone = moment_timezone.tz.zone(tz);
        if (zone === null) {
            throw new Error(`Fail to create timezone from "${tz}"`);
        }
        const offset = zone.utcOffset(utc);
        return new Timezone(
            tz,
            `${offset === 0 ? '' : offset > 0 ? '-' : '+'}${Math.abs(offset) / 60}`,
            offset,
        );
    }

    public getNameAsHtml(): string {
        if (this._filter === '') {
            return this.name;
        }
        const reg = regex.fromStr(this._filter);
        if (reg instanceof Error) {
            return this.name;
        }
        return this.name.replace(reg, (match): string => {
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
        return this.utc.replace(reg, (match): string => {
            return `<span>${match}</span>`;
        });
    }

    public filter(filter: string) {
        this._filter = filter.trim();
        this.hidden =
            this._filter === ''
                ? false
                : this.name.toLowerCase().indexOf(filter) === -1 &&
                  this.utc.toLowerCase().indexOf(filter) === -1;
    }
}
