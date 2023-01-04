import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { cutUuid } from '@log/index';
import { Stream } from './stream';
import { Search } from './search';
import { IRange } from '@platform/types/range';
import { bridge } from '@service/bridge';

@SetupLogger()
export class Exporter {
    private _uuid!: string;
    private _stream!: Stream;
    private _search!: Search;

    public init(uuid: string, stream: Stream, search: Search) {
        this.setLoggerName(`Cache: ${cutUuid(uuid)}`);
        this._uuid = uuid;
        this._stream = stream;
        this._search = search;
    }

    public destroy() {
        //
    }

    public isRawAvailable(): Promise<boolean> {
        return this._stream.export().isRawAvailable();
    }

    public export(asRaw: boolean): {
        stream(ranges: IRange[]): Promise<boolean>;
        search(): Promise<boolean>;
    } {
        return {
            stream: async (ranges: IRange[]): Promise<boolean> => {
                if (ranges.length === 0) {
                    return false;
                }
                const dest = await bridge.files().select.save();
                if (dest === undefined) {
                    return false;
                }
                return asRaw
                    ? this._stream.export().raw(dest, ranges)
                    : this._stream.export().text(dest, ranges);
            },
            search: async (): Promise<boolean> => {
                const ranges = this._search.map.get().all();
                if (ranges.length === 0) {
                    return false;
                }
                const dest = await bridge.files().select.save();
                if (dest === undefined) {
                    return false;
                }
                return asRaw
                    ? this._stream.export().raw(dest, ranges)
                    : this._stream.export().text(dest, ranges);
            },
        };
    }
}
export interface Exporter extends LoggerInterface {}
