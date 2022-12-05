import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { error } from '@platform/env/logger';
import { Subject, Subscriber } from '@platform/env/subscription';
import { IRange, fromIndexes } from '@platform/types/range';
import { Bookmarks } from '../bookmarks';
import { Cursor } from '../cursor';
import { Stream } from '../stream';
import { Breadcrumbs } from './breadcrumbs';

@SetupLogger()
export class Map extends Subscriber {
    public updated: Subject<void> = new Subject();
    private _matches: number[] = [];
    private _mixed: number[] = [];
    private readonly _modes: {
        selections: boolean;
        breadcrumbs: boolean;
        bookmarks: boolean;
    } = {
        selections: false,
        breadcrumbs: false,
        bookmarks: true,
    };
    public readonly breadcrumbs: Breadcrumbs = new Breadcrumbs();
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
        this.register(
            this.cursor.subjects.get().updated.subscribe(() => {
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

    public extending(position: number, before: boolean): void {
        const finish = this.log().measure(`Extending map for ${this._matches.length} matches`);
        this.breadcrumbs.extending(position, before);
        const matches = this.getMatchesWithBookmarks();
        this._mixed = matches.concat(this.breadcrumbs.extended).sort((a, b) => (a > b ? 1 : -1));
        finish();
        this.updated.emit();
    }

    public modes(): {
        selections(): boolean;
        breadcrumbs(): boolean;
        bookmarks(): boolean;
        toggle(): {
            selections(): void;
            breadcrumbs(): void;
            bookmarks(): void;
        };
    } {
        return {
            selections: (): boolean => {
                return this._modes.selections;
            },
            breadcrumbs: (): boolean => {
                return this._modes.breadcrumbs;
            },
            bookmarks: (): boolean => {
                return this._modes.bookmarks;
            },
            toggle: (): {
                selections(): void;
                breadcrumbs(): void;
                bookmarks(): void;
            } => {
                return {
                    selections: (): void => {
                        this._modes.selections = !this._modes.selections;
                        this._modes.breadcrumbs = false;
                        this.build();
                    },
                    breadcrumbs: (): void => {
                        this._modes.breadcrumbs = !this._modes.breadcrumbs;
                        this._modes.selections = false;
                        this.build();
                    },
                    bookmarks: (): void => {
                        this._modes.bookmarks = !this._modes.bookmarks;
                        this.build();
                    },
                };
            },
        };
    }

    public parse(str: string | null): Error | undefined {
        if (str === null) {
            this._matches = [];
            this._mixed = [];
            this.breadcrumbs.drop();
        } else {
            try {
                const matches: number[] = JSON.parse(str);
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

    public len(): number {
        return this._mixed.length;
    }

    protected build() {
        const finish = this.log().measure(`Building map for ${this._matches.length} matches`);
        if (this._modes.breadcrumbs) {
            if (this._modes.bookmarks) {
                const matches = this.getMatchesWithBookmarks();
                this._mixed = matches
                    .concat(this.breadcrumbs.collect(matches, this.stream.len()))
                    .sort((a, b) => (a > b ? 1 : -1));
            } else {
                this._mixed = this._matches
                    .concat(this.breadcrumbs.collect(this._matches, this.stream.len()))
                    .sort((a, b) => (a > b ? 1 : -1));
            }
        } else {
            this._mixed = Array.from(
                new Set(
                    this._matches
                        .concat(this._modes.bookmarks ? this.bookmarks.getRowsPositions() : [])
                        .concat(this._modes.selections ? this.cursor.get() : []),
                ).values(),
            ).sort((a, b) => (a > b ? 1 : -1));
        }
        finish();
        this.updated.emit();
    }

    protected getMatchesWithBookmarks(): number[] {
        return Array.from(
            new Set(
                this._matches.concat(
                    this._modes.bookmarks ? this.bookmarks.getRowsPositions() : [],
                ),
            ).values(),
        ).sort((a, b) => (a > b ? 1 : -1));
    }
}
export interface Map extends LoggerInterface {}
