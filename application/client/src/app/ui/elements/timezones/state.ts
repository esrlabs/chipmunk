import { Timezone } from '@elements/timezones/timezone';
import { Holder } from '@module/matcher';

import * as moment_timezone from 'moment-timezone';

let cache: Timezone[] | undefined;

export class State extends Holder {
    public timezones: Timezone[] = [];

    constructor() {
        super();
        const now = new Date();
        const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth());
        if (cache !== undefined) {
            this.timezones = cache;
        } else {
            this.timezones = moment_timezone.tz
                .names()
                .map((tzName: string) => {
                    const zone = moment_timezone.tz.zone(tzName);
                    if (zone === null) {
                        return undefined;
                    } else {
                        const offset = zone.utcOffset(utc);
                        return new Timezone(
                            tzName,
                            `${offset === 0 ? '' : offset > 0 ? '-' : '+'}${Math.abs(offset) / 60}`,
                            offset,
                            this.matcher,
                        );
                    }
                })
                .filter((t) => t !== undefined) as Timezone[];
            this.timezones.unshift(new Timezone('UTC', '', 0, this.matcher));
            cache = this.timezones;
        }
    }

    public update(value: string): void {
        this.matcher.search(value);
        this.timezones = this.timezones.sort(
            (a: Timezone, b: Timezone) => b.getScore() - a.getScore(),
        );
    }
}
