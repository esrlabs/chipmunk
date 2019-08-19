import * as Stream from 'stream';
import { IRange, IMapItem } from './controller.stream.search.map';
import Logger from '../tools/env.logger';

export interface ITransformResult {
    output: string;
    bytesSize: number;
    map: IMapItem;
}

export type TBeforeCallbackHandle = (results: ITransformResult) => Promise<void>;

export default class Transform extends Stream.Transform {

    private _logger: Logger;
    private _rest: string = '';
    private _streamId: string;
    private _beforeCallbackHandle: TBeforeCallbackHandle | undefined;
    private _offsets: { bytes: number, rows: number } = { bytes: 0, rows: 0 };
    private _map: IMapItem[] = [];

    constructor(options: Stream.TransformOptions,
                streamId: string,
                offsets: { bytes: number, rows: number }) {

        super(options);
        this._streamId = streamId;
        this._offsets = offsets;
        this._logger = new Logger(`ControllerSearchTransformer: ${this._streamId}`);
    }

    public setBeforeCallbackHandle(handle: TBeforeCallbackHandle | undefined) {
        this._beforeCallbackHandle = handle;
    }

    public _transform(chunk: Buffer | string, encoding: string, callback: Stream.TransformCallback | undefined): ITransformResult {
        // Convert to utf8 and insert rest from previos
        let output: string = '';
        if (typeof chunk === 'string') {
            output = `${this._rest}${chunk}`;
        } else {
            output = `${this._rest}${chunk.toString('utf8')}`;
        }
        // Get rest from the end
        const rest = this._getRest(output);
        this._rest = rest.rest;
        output = rest.cleared;
        // Add indexes
        const rows: IRange = {
            from: this._offsets.rows,
            to: this._offsets.rows + output.split(/[\n\r]/gi).length - 1,
        };
        // Store cursor position
        const bytes = {
            from: this._offsets.bytes,
            to: this._offsets.bytes,
        };
        const size: number = Buffer.byteLength(output, 'utf8');
        rows.to -= 1;
        bytes.to += size - 1;
        const results: ITransformResult = {
            output: output,
            bytesSize: size,
            map: { rows: rows, bytes: bytes },
        };
        // Update offsets
        this._offsets.rows = results.map.rows.to + 1;
        this._offsets.bytes = results.map.bytes.to + 1;
        // Store map
        this._map.push(results.map);
        // Call callback
        if (callback !== undefined) {
            if (typeof this._beforeCallbackHandle === 'function') {
                this._beforeCallbackHandle(results).then(() => {
                    callback(undefined, output);
                }).catch((error: Error) => {
                    this._logger.warn(`Error from "beforeCallbackHandle": ${error.message}`);
                    callback(undefined, output);
                });
            } else {
                callback(undefined, output);
            }
        } else if (typeof this._beforeCallbackHandle === 'function') {
            this._beforeCallbackHandle(results).catch((error: Error) => {
                this._logger.warn(`Error from "beforeCallbackHandle": ${error.message}`);
            });
        }
        return results;
    }

    public convert(chunk: Buffer | string): ITransformResult {
        return this._transform(chunk, 'utf8', undefined);
    }

    public getMap(): IMapItem[] {
        return this._map;
    }

    private _getRest(str: string): { rest: string, cleared: string } {
        const last = str.length - 1;
        for (let i = last; i >= 0; i -= 1) {
            if (str[i] === '\n' && i > 0) {
                return {
                    rest: str.substr(i + 1, last),
                    cleared: str.substr(0, i + 1),
                };
            }
        }
        return { rest: '', cleared: str };
    }

}
