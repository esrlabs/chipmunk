import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { error } from '@platform/env/logger';
import { Subject, Subscriber } from '@platform/env/subscription';
import { Bookmarks } from '../bookmarks';
import { Cache } from '../cache';

@SetupLogger()
export class Map extends Subscriber {
    public updated: Subject<void> = new Subject();

    private _matches: number[] = [];
    private _mixed: number[] = [];
    private _injected: number = 0;

    protected bookmarks!: Bookmarks;
    protected cache!: Cache;

    public init(bookmarks: Bookmarks, cache: Cache): void {
        this.bookmarks = bookmarks;
        this.cache = cache;
        this.register(
            this.bookmarks.subjects.get().updated.subscribe(() => {
                this.build();
            }),
        );
        this.register(
            this.cache.updated.subscribe(() => {
                this.build();
            }),
        );
    }

    public destroy(): void {
        this.updated.destroy();
        this.unsubscribe();
    }

    public parse(str: string | null): Error | undefined {
        if (str === null) {
            this._matches = [];
            this._mixed = [];
        } else {
            try {
                const matches = JSON.parse(str);
                if (!(matches instanceof Array)) {
                    throw new Error(`Map of matches should be an array`);
                }
                this._matches = this._matches.concat(matches);
            } catch (e) {
                return new Error(error(e));
            }
        }
        this.build();
        return undefined;
    }

    public getInjectedCount(): number {
        return this._injected;
    }

    public getRowsPositions(): number[] {
        return this._mixed;
    }

    public getStreamPositionOn(row: number): number | undefined {
        return this._mixed[row] === undefined ? undefined : this._mixed[row];
    }

    public getCorrectedPosition(row: number): number | undefined {
        if (this._matches.length === 0) {
            return undefined;
        }
        if (this._matches.length === 1) {
            return 0;
        }
        const stream = this._mixed[row];
        if (stream === undefined) {
            return undefined;
        }
        let position = this._matches.indexOf(stream);
        if (position !== -1) {
            return position;
        }
        let distance = Infinity;
        let detected = false;
        this._matches.forEach((s, i) => {
            if (detected) {
                return;
            }
            const dis = Math.abs(s - stream);
            if (dis < distance) {
                distance = dis;
                position = i;
            }
            if (dis > distance) {
                detected = true;
            }
        });
        if (position === -1) {
            throw new Error(`Fail to find corrected position`);
        }
        return position;
    }

    protected build() {
        const filtered: number[] = [];
        const injections = this.cache
            .getRowsPositions()
            .slice()
            .concat(this.bookmarks.getRowsPositions())
            .filter((p) => {
                if (filtered.indexOf(p) !== -1 || this._matches.indexOf(p) !== -1) {
                    return false;
                } else {
                    filtered.push(p);
                    return true;
                }
            });
        this._injected = injections.length;
        this._mixed = this._matches.concat(injections).sort((a, b) => (a > b ? 1 : -1));
        this.updated.emit();
    }
}
export interface Map extends LoggerInterface {}
