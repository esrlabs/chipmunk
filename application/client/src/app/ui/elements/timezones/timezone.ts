import * as moment_timezone from 'moment-timezone';
import { getMatcher } from '@ui/env/globals';
export class Timezone {
    public readonly name: string;
    public readonly utc: string;
    public readonly offset: number;
    public hidden: boolean = false;

    private _htmlName: string;
    private _htmlUtc: string;

    constructor(name: string, utc: string, offset: number) {
        this.name = name;
        this._htmlName = name;
        this.utc = utc;
        this._htmlUtc = utc;
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

    public get htmlName(): string {
        return this._htmlName;
    }

    public get htmlUtc(): string {
        return this._htmlUtc;
    }

    public filter(filter: string) {
        const name = getMatcher().search_single(filter, this.name);
        const utc = getMatcher().search_single(filter, this.utc);
        if (name === this.name && utc === this.utc && filter !== '') {
            this.hidden = true;
        } else {
            this.hidden = false;
            this._htmlName = name;
            this._htmlUtc = utc;
        }
    }
}
