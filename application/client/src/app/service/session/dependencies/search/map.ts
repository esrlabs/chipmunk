import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { error } from '@platform/env/logger';
import { Subject, Subscriber } from '@platform/env/subscription';
import { IRange, fromIndexes } from '@platform/types/range';

@SetupLogger()
export class Map extends Subscriber {
    public updated: Subject<void> = new Subject();
    private _matches: number[] = [];

    public destroy(): void {
        this.updated.destroy();
        this.unsubscribe();
    }

    public get(): {
        ranges(range: IRange): IRange[];
        all(): IRange[];
    } {
        return {
            ranges: (range: IRange): IRange[] => {
                if (range.from > this._matches.length - 1) {
                    return [];
                }
                const to =
                    range.to < this._matches.length - 1 ? range.to : this._matches.length - 1;
                const indexes = [];
                for (let i = range.from; i <= to; i += 1) {
                    indexes.push(this._matches[i]);
                }
                return fromIndexes(indexes);
            },
            all: (): IRange[] => {
                return fromIndexes(this._matches);
            },
        };
    }

    public parse(str: string | null): Error | undefined {
        if (str === null) {
            this._matches = [];
        } else {
            try {
                const matches: number[] = JSON.parse(str);
                if (!(matches instanceof Array)) {
                    throw new Error(`Map of matches should be an array`);
                }
                this._matches = this._matches.concat(matches);
            } catch (e) {
                this._matches = [];
                return new Error(error(e));
            }
        }
        this.updated.emit();
        return undefined;
    }

    public len(): number {
        return this._matches.length;
    }
}
export interface Map extends LoggerInterface {}
