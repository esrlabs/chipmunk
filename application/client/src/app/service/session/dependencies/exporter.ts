import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { cutUuid } from '@log/index';
import { Cursor } from './cursor';
import { Stream } from './stream';
import { Range } from '@platform/types/range';
import { bridge } from '@service/bridge';

@SetupLogger()
export class Exporter {
    private _uuid!: string;
    private _cursor!: Cursor;
    private _stream!: Stream;

    public init(uuid: string, cursor: Cursor, stream: Stream) {
        this.setLoggerName(`Cache: ${cutUuid(uuid)}`);
        this._uuid = uuid;
        this._cursor = cursor;
        this._stream = stream;
    }

    public destroy() {
        //
    }

    public async export(): Promise<boolean> {
        const selected = this._cursor.get().slice();
        if (selected.length === 0) {
            return false;
        }
        const dest = await bridge.files().select.save();
        if (dest === undefined) {
            return false;
        }
        selected.sort((a, b) => (a > b ? 1 : -1));
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
        console.log(`>>>>>>>>>>>>>>>>`);
        console.log(ranges);
        return this._stream.export(
            dest,
            ranges.map((r) => r.get()),
        );
    }
}
export interface Exporter extends LoggerInterface {}
