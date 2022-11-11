import * as moment_timezone from 'moment-timezone';
import * as wasm from '@loader/wasm';

import { Matchee } from '@module/matcher';

export class Timezone extends Matchee {
    public readonly name: string;
    public readonly utc: string;
    public readonly offset: number;

    static matcher: wasm.Matcher;

    constructor(name: string, utc: string, offset: number, matcher: wasm.Matcher) {
        super(matcher, { name: name, utc: utc });
        Timezone.matcher = matcher;
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
            Timezone.matcher,
        );
    }

    public hidden(): boolean {
        return this.getScore() === 0;
    }

    public get html(): {
        name: string;
        utc: string;
    } {
        const name: string | undefined = this.getHtmlOf('html_name');
        const utc: string | undefined = this.getHtmlOf('html_utc');
        return {
            name: name === undefined ? this.name : name,
            utc: utc === undefined ? this.utc : utc,
        };
    }
}
