import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { cutUuid } from '@log/index';
import { Stream } from './stream';
import { Indexed } from './indexed';
import { IRange } from '@platform/types/range';
import { bridge } from '@service/bridge';
import { TextExportOptions } from '@platform/types/exporting';

import * as Requests from '@platform/ipc/request/index';

@SetupLogger()
export class Exporter {
    private _uuid!: string;
    private _stream!: Stream;
    private _indexed!: Indexed;

    public init(uuid: string, stream: Stream, indexed: Indexed) {
        this.setLoggerName(`Cache: ${cutUuid(uuid)}`);
        this._uuid = uuid;
        this._stream = stream;
        this._indexed = indexed;
    }

    public destroy() {
        //
    }

    public isRawAvailable(): Promise<boolean> {
        return this._stream.export().isRawAvailable();
    }

    public export(
        asRaw: boolean,
        opt?: TextExportOptions,
    ): {
        all(): Promise<void>;
        stream(ranges: IRange[]): Promise<string | undefined>;
        search(): Promise<string | undefined>;
    } {
        const uuid = this._uuid;
        return {
            all(): Promise<void> {
                return Requests.IpcRequest.send(
                    Requests.File.ExportSession.Response,
                    new Requests.File.ExportSession.Request({
                        uuid,
                    }),
                ).then(() => {
                    return Promise.resolve(undefined);
                });
            },
            stream: async (ranges: IRange[]): Promise<string | undefined> => {
                if (ranges.length === 0) {
                    return undefined;
                }
                const dest = await bridge.files().select.save();
                if (dest === undefined) {
                    return undefined;
                }
                return asRaw
                    ? this._stream.export().raw(ranges, dest)
                    : this._stream.export().text(ranges, dest, opt);
            },
            search: async (): Promise<string | undefined> => {
                if (this._indexed.len() === 0) {
                    return undefined;
                }
                const dest = await bridge.files().select.save();
                if (dest === undefined) {
                    return undefined;
                }
                const ranges = await this._indexed.asRanges();
                return asRaw
                    ? this._stream.export().raw(ranges, dest)
                    : this._stream.export().text(ranges, dest, opt);
            },
        };
    }

    // Clone search results to new file and returns filepath
    public async clone(): Promise<string | undefined> {
        if (this._indexed.len() === 0) {
            return undefined;
        }
        const ranges = await this._indexed.asRanges();
        return (await this.isRawAvailable())
            ? this._stream.export().raw(ranges)
            : this._stream.export().text(ranges);
    }
}
export interface Exporter extends LoggerInterface {}
