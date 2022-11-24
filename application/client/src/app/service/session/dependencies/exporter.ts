import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { cutUuid } from '@log/index';
import { Cursor } from './cursor';
import { Stream } from './stream';
import { Search } from './search';
import { Range } from '@platform/types/range';
import { bridge } from '@service/bridge';
import { Bookmarks } from './bookmarks';

@SetupLogger()
export class Exporter {
    private _uuid!: string;
    private _cursor!: Cursor;
    private _stream!: Stream;
    private _search!: Search;
    private _bookmarks!: Bookmarks;

    public init(
        uuid: string,
        cursor: Cursor,
        bookmarks: Bookmarks,
        stream: Stream,
        search: Search,
    ) {
        this.setLoggerName(`Cache: ${cutUuid(uuid)}`);
        this._uuid = uuid;
        this._cursor = cursor;
        this._bookmarks = bookmarks;
        this._stream = stream;
        this._search = search;
    }

    protected getAllSelected(): number[] {
        let selected = this._cursor.get().slice();
        const bookmarks = this._bookmarks
            .get()
            .map((b) => b.stream())
            .filter((b) => selected.indexOf(b) === -1);
        selected = selected.concat(bookmarks);
        selected.sort((a, b) => (a > b ? 1 : -1));
        return selected;
    }

    public destroy() {
        //
    }

    public isRawAvailable(): Promise<boolean> {
        return this._stream.export().isRawAvailable();
    }

    public export(asRaw: boolean): {
        stream(): Promise<boolean>;
        search(): Promise<boolean>;
    } {
        return {
            stream: async (): Promise<boolean> => {
                const selected = this.getAllSelected();
                if (selected.length === 0) {
                    return false;
                }
                const dest = await bridge.files().select.save();
                if (dest === undefined) {
                    return false;
                }
                const ranges: Range[] = [];
                let start: number | undefined;
                let prev: number = -1;
                selected.forEach((row: number, i: number) => {
                    if (start === undefined) {
                        start = row;
                    } else if (row !== prev + 1) {
                        ranges.push(new Range(start, prev));
                        start = row;
                    }
                    if (selected.length - 1 === i) {
                        ranges.push(new Range(start, row));
                    }
                    prev = row;
                });
                return asRaw
                    ? this._stream.export().raw(
                          dest,
                          ranges.map((r) => r.get()),
                      )
                    : this._stream.export().text(
                          dest,
                          ranges.map((r) => r.get()),
                      );
            },
            search: async (): Promise<boolean> => {
                const selected = this.getAllSelected();
                if (selected.length === 0 && this._search.len() === 0) {
                    return false;
                }
                const dest = await bridge.files().select.save();
                if (dest === undefined) {
                    return false;
                }
                const ranges: Range[] = [];
                let start: number | undefined;
                let prev: number = -1;
                selected.forEach((row: number, i: number) => {
                    if (start === undefined) {
                        start = row;
                    } else if (row !== prev + 1) {
                        ranges.push(new Range(start, prev));
                        start = row;
                    }
                    if (selected.length - 1 === i) {
                        ranges.push(new Range(start, row));
                    }
                    prev = row;
                });
                return asRaw
                    ? this._search.export().raw(
                          dest,
                          ranges.map((r) => r.get()),
                      )
                    : this._search.export().text(
                          dest,
                          ranges.map((r) => r.get()),
                      );
            },
        };
    }
}
export interface Exporter extends LoggerInterface {}
