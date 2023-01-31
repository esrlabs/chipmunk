import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { error } from '@platform/env/logger';
import { Subject, Subscriber } from '@platform/env/subscription';
import { IRange, fromIndexes } from '@platform/types/range';
import { Bookmarks } from '../bookmarks';
import { Cursor } from '../cursor';
import { Stream } from '../stream';

@SetupLogger()
export class Map extends Subscriber {
    public updated: Subject<void> = new Subject();
    private _matches: number[] = [];
    private _mixed: number[] = [];
    private readonly _hash: {
        bookmarks: string;
    } = {
        bookmarks: '',
    };
    protected bookmarks!: Bookmarks;
    protected stream!: Stream;
    protected cursor!: Cursor;

    public init(stream: Stream, bookmarks: Bookmarks, cursor: Cursor): void {
        this.stream = stream;
        this.bookmarks = bookmarks;
        this.cursor = cursor;
        this.register(
            this.bookmarks.subjects.get().updated.subscribe(() => {
                this.build();
            }),
        );
    }

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
                if (range.from > this._mixed.length - 1) {
                    return [];
                }
                const to = range.to < this._mixed.length - 1 ? range.to : this._mixed.length - 1;
                const indexes = [];
                for (let i = range.from; i <= to; i += 1) {
                    indexes.push(this._mixed[i]);
                }
                return fromIndexes(indexes);
            },
            all: (): IRange[] => {
                return fromIndexes(this._mixed);
            },
        };
    }

    public parse(str: string | null): Error | undefined {
        const drop = () => {
            this._matches = [];
            this._mixed = [];
            this.build();
        };
        if (str === null) {
            drop();
        } else {
            try {
                const matches: number[] = JSON.parse(str);
                if (!(matches instanceof Array)) {
                    throw new Error(`Map of matches should be an array`);
                }
                this._matches = this._matches.concat(matches);
                this.build(matches);
            } catch (e) {
                drop();
                return new Error(error(e));
            }
        }
        return undefined;
    }

    public len(): number {
        return this._mixed.length;
    }

    protected build(matches?: number[]) {
        const finish = this.log().measure(`Building map for ${this._matches.length} matches`, 50);
        const build = () => {
            this._mixed = Array.from(
                new Set(this._matches.concat(this.bookmarks.getRowsPositions())).values(),
            ).sort((a, b) => (a > b ? 1 : -1));
        };
        if (matches !== undefined) {
            const bookmarks = this.bookmarks.hash();
            if (this._hash.bookmarks !== bookmarks) {
                this._hash.bookmarks = bookmarks;
                build();
            } else {
                this._mixed = this._mixed.concat(matches);
            }
        } else {
            build();
        }
        finish();
        this.updated.emit();
    }

    protected getMatchesWithBookmarks(): number[] {
        return Array.from(
            new Set(this._matches.concat(this.bookmarks.getRowsPositions())).values(),
        ).sort((a, b) => (a > b ? 1 : -1));
    }
}
export interface Map extends LoggerInterface {}
