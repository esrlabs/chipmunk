import * as moment_timezone from 'moment-timezone';
import { Matcher } from '@matcher/matcher';

export class Timezone {
    public readonly name: string;
    public readonly utc: string;
    public readonly offset: number;
    public hidden: boolean = false;

    private _matcher: Matcher = Matcher.new();
    private _html_name: string;
    private _html_utc: string;

    constructor(name: string, utc: string, offset: number) {
        this.name = name;
        this._html_name = name;
        this.utc = utc;
        this._html_utc = utc;
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

    public get html_name(): string {
        return this._html_name;
    }

    public get html_utc(): string {
        return this._html_utc;
    }

    public filter(filter: string) {
        const name = this._matcher.search_single(filter, this.name);
        const utc = this._matcher.search_single(filter, this.utc);
        if (name === this.name && utc === this.utc && filter !== '') {
            this.hidden = true;
        } else {
            this.hidden = false;
            this._html_name = name;
            this._html_utc = utc;
        }
    }
}
