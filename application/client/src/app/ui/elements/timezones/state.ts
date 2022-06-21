import { Filter } from '@ui/env/entities/filter';
import { Timezone } from '@ui/elements/timezones/timezone';
import { InternalAPI } from '@service/ilc';

import * as moment_timezone from 'moment-timezone';

export class State {
    public filter: Filter;
    public timezones: Timezone[] = [];

    constructor(ilc: InternalAPI) {
        const now = new Date();
        const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth());
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
                    );
                }
            })
            .filter((t) => t !== undefined) as Timezone[];
        this.timezones.unshift(new Timezone('UTC', '', 0));
        this.filter = new Filter(ilc);
    }

    public update(): void {
        this.timezones.forEach((timezone) => {
            timezone.filter(this.filter.value());
        });
    }
}
