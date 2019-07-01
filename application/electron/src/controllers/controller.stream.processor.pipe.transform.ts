// tslint:disable:variable-name
import * as Stream from 'stream';
import { IRange, IMapItem } from './controller.stream.processor.map';
import * as StreamMarkers from '../consts/stream.markers';
import Logger from '../tools/env.logger';

export interface ITransformResult {
    output: string;
    bytesSize: number;
    map: IMapItem;
}

export type TBeforeCallbackHandle = (results: ITransformResult) => Promise<void>;

export function getSourceMarker(sourceId: string | number): string {
    return `${StreamMarkers.PluginId}${sourceId}${StreamMarkers.PluginId}`;
}

export default class Transform extends Stream.Transform {

    public static Events = {
        onMap: 'onMap',
    };

    private _logger: Logger;
    private _pluginId: number;
    private _rest: string = '';
    private _streamId: string;
    private _beforeCallbackHandle: TBeforeCallbackHandle | undefined;
    private _offsets: { bytes: number, rows: number } = { bytes: 0, rows: 0 };
    private _map: IMapItem[] = [];
    private _writtenBytes: number = 0;

    constructor(options: Stream.TransformOptions,
                streamId: string,
                pluginId: number,
                offsets: { bytes: number, rows: number }) {

        super(options);
        this._streamId = streamId;
        this._pluginId = pluginId;
        this._offsets = offsets;
        this._logger = new Logger(`ControllerStreamTransformer: ${this._streamId}`);
    }

    public setBeforeCallbackHandle(handle: TBeforeCallbackHandle | undefined) {
        this._beforeCallbackHandle = handle;
    }

    public _transform(  chunk: Buffer | string,
                        encoding: string,
                        callback: Stream.TransformCallback | undefined): ITransformResult {

        // Convert to utf8 and insert rest from previos
        let output: string = '';
        if (typeof chunk === 'string') {
            output = `${this._rest}${chunk}`;
        } else {
            output = `${this._rest}${chunk.toString('utf8')}`;
        }
        // Remove double carret
        output = output.replace(/[\r?\n|\r]/gi, '\n').replace(/\n{2,}/g, '\n');
        // Get rest from the end
        const rest = this._getRest(output);
        this._rest = rest.rest;
        output = rest.cleared;
        // Add indexes
        const rows: IRange = {
            from: this._offsets.rows,
            to: this._offsets.rows,
        };
        // Store cursor position
        const bytes = {
            from: this._offsets.bytes,
            to: this._offsets.bytes,
        };
        output = output.replace(/[\r?\n|\r]/gi, () => {
            return `${getSourceMarker(this._pluginId)}${StreamMarkers.RowNumber}${rows.to++}${StreamMarkers.RowNumber}\n`;
        });
        const size: number = Buffer.byteLength(output, 'utf8');
        rows.to -= 1;
        bytes.to += size - 1;
        const results: ITransformResult = {
            output: output,
            bytesSize: size,
            map: { rows: rows, bytes: bytes },
        };
        // Update size
        this._writtenBytes += size;
        // Update offsets
        this._offsets.rows = results.map.rows.to + 1;
        this._offsets.bytes = results.map.bytes.to + 1;
        // Store map
        this._map.push(results.map);
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
        this.emit(Transform.Events.onMap, results.map, size);
        return results;
    }

    public convert(chunk: Buffer | string): ITransformResult {
        return this._transform(chunk, 'utf8', undefined);
    }

    public getMap(): IMapItem[] {
        return this._map;
    }

    public getBytesWritten(): number {
        return this._writtenBytes;
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
