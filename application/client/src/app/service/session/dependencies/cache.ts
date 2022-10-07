import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subject } from '@platform/env/subscription';
import { cutUuid } from '@log/index';
import { Cursor } from './cursor';
import { Stream } from './stream';
import { Range } from '@platform/types/range';
import { IGrabbedElement } from '@platform/types/content';

const MAX_CACHED_CONTENT_LEN = 1024 * 1024 * 25; // 25 Mb
const MAX_CACHED_ROWS_COUNT = Math.round(MAX_CACHED_CONTENT_LEN / 1024);

@SetupLogger()
export class Cache extends Subscriber {
    public updated: Subject<void> = new Subject();
    private _uuid!: string;
    private _cursor!: Cursor;
    private _stream!: Stream;

    protected rows: Map<number, IGrabbedElement> = new Map();
    protected selected: number[] = [];

    public init(uuid: string, cursor: Cursor, stream: Stream) {
        this.setLoggerName(`Cache: ${cutUuid(uuid)}`);
        this._uuid = uuid;
        this._cursor = cursor;
        this._stream = stream;
        this.register(
            this._cursor.subjects.get().updated.subscribe(() => {
                this.load();
            }),
        );
    }

    public destroy() {
        this.unsubscribe();
        this.rows.clear();
    }

    public getRowsPositions(): number[] {
        return this.selected;
    }

    public getRowsFrom(from: number, count: number): IGrabbedElement[] {
        const rows: IGrabbedElement[] = [];
        try {
            this.selected.forEach((row: number) => {
                if (count < rows.length) {
                    throw `enough`;
                }
                if (row >= from) {
                    const grabbed = this.rows.get(row);
                    grabbed !== undefined && rows.push(grabbed);
                }
            });
        } catch (_e) {
            // Do nothing, just exit
        }
        return rows;
    }

    public getRows(): IGrabbedElement[] {
        return Array.from(this.rows.values()).sort((a, b) => (a.position > b.position ? 1 : -1));
    }

    protected load() {
        // TODO: add limit of cache. For example, doesn't make sense to store all rows if file is > 1Gb
        this.selected = this._cursor.get().slice();
        if (this.selected.length === 0) {
            this.rows.clear();
            this.updated.emit();
            return;
        }
        if (this.selected.length === 1) {
            const single = this._cursor.getSingle();
            this.rows.clear();
            if (single === undefined) {
                this.log().warn(`Fail to get single selection`);
                this.selected = [];
            } else {
                this.rows.set(this.selected[0], single.as().grabbed(this.selected[0]));
            }
            this.updated.emit();
            return;
        }
        this.selected.sort((a, b) => (a > b ? 1 : -1));
        // Remove unselected rows
        this.rows.forEach((_row, pos: number) => {
            if (this.selected.indexOf(pos) === -1) {
                this.rows.delete(pos);
            }
        });
        // Build list of rows to be requested
        const absent: number[] = [];
        let size = 0;
        this.selected.forEach((pos: number) => {
            const row = this.rows.get(pos);
            if (row === undefined) {
                absent.push(pos);
            } else {
                size += row.content.length;
            }
        });
        const checked = ((indexes: number[]) => {
            if (size > MAX_CACHED_CONTENT_LEN) {
                // Do not upload more
                return { toLoad: [], toCut: indexes };
            }
            const overLimitCount = this.rows.size + indexes.length - MAX_CACHED_ROWS_COUNT;
            if (overLimitCount > 0) {
                if (indexes.length < overLimitCount) {
                    // Do not upload any
                    return { toLoad: [], toCut: indexes };
                }
                // Cut content
                const toCut = indexes.splice(overLimitCount - indexes.length, indexes.length);
                return {
                    toLoad: indexes,
                    toCut,
                };
            }
            return { toLoad: indexes, toCut: [] };
        })(absent);
        this.selected = this.selected.filter((r) => checked.toCut.indexOf(r) === -1);
        // Gets ranges to be requested
        const ranges: Range[] = [];
        let start: number | undefined;
        let prev: number = -1;
        checked.toLoad.forEach((row: number, i: number) => {
            if (start === undefined) {
                start = row;
            } else if (row !== prev + 1) {
                ranges.push(new Range(start, prev));
                start = row;
            }
            if (checked.toLoad.length - 1 === i) {
                ranges.push(new Range(start, row));
            }
            prev = row;
        });
        // Request data
        Promise.all(
            ranges.map((range) => {
                return this._stream.chunk(range).then((grabbed) => {
                    grabbed.forEach((row) => {
                        this.rows.set(row.position, row);
                    });
                });
            }),
        )
            .catch((err: Error) => {
                this.rows.clear();
                this.selected = [];
                this.log().error(`Fail to request range: ${err.message}`);
            })
            .finally(() => {
                this.updated.emit();
            });
    }
}
export interface Cache extends LoggerInterface {}
