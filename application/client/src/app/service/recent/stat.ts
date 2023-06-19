import { error } from '@platform/log/utils';
import { scope } from '@platform/env/scope';

import * as obj from '@platform/env/obj';

export interface IStat {
    used: number;
    last: number;
    size: number | undefined;
}

export class Stat {
    public static from(inputs: IStat): Stat {
        try {
            return new Stat({
                size: obj.getAsValidNumberOrUndefined(inputs, 'size'),
                last: obj.getAsValidNumber(inputs, 'last'),
                used: obj.getAsValidNumber(inputs, 'used'),
            });
        } catch (e) {
            scope.getLogger(`RecentStat`).warn(`Stat of recent action parsing error: ${error(e)}`);
            return Stat.defaults();
        }
    }

    public static defaults(): Stat {
        return new Stat({
            size: undefined,
            used: 0,
            last: Date.now(),
        });
    }

    public used: number = 0;
    public last: number = Date.now();
    public size: number | undefined;

    constructor(stat: IStat) {
        this.size = stat.size;
        this.used = stat.used;
        this.last = stat.last;
    }

    public update(): Stat {
        this.used += 1;
        this.last = Date.now();
        return this;
    }

    public asObj(): IStat {
        return {
            used: this.used,
            last: this.last,
            size: this.size,
        };
    }

    public score(): {
        usage(): number;
        recent(): number;
        mixed(): number;
    } {
        return {
            usage: (): number => {
                return this.used;
            },
            recent: (): number => {
                return this.last;
            },
            mixed: (): number => {
                const now = Date.now();
                const days = Math.ceil(
                    (now - this.last <= 0 ? 1 : now - this.last) / 1000 / 60 / 60 / 24,
                );
                return this.used * (1 / days);
            },
        };
    }
}
