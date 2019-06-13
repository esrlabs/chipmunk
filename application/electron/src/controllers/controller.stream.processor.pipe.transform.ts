// tslint:disable:variable-name
import * as Stream from 'stream';
import { IRange } from './controller.stream.processor.map';
import * as StreamMarkers from '../consts/stream.markers';
import Logger from '../tools/env.logger';
import State from './controller.stream.processor.state';
import StreamState from './controller.stream.state';

export interface ITransformResult {
    output: string;
    bytesSize: number;
    rows: IRange;
}

export type TBeforeNotifyHandle = (results: ITransformResult) => Promise<void>;

const Settings = {
    notificationDelayOnStream: 500,             // ms, Delay for sending notifications about stream's update to render (client) via IPC, when stream is blocked
    maxPostponedNotificationMessages: 500,      // How many IPC messages to render (client) should be postponed via timer
};

export function convert(streamId: string,
                        pluginId: number,
                        state: State,
                        streamState: StreamState,
                        chunk: Buffer | string,
                        beforeNotifyHandle?: TBeforeNotifyHandle,
                        ): ITransformResult {

    const transform: Transform = new Transform({}, streamId, pluginId, state, streamState, beforeNotifyHandle);
    return transform.convert(chunk);
}

export function getSourceMarker(sourceId: string | number): string {
    return `${StreamMarkers.PluginId}${sourceId}${StreamMarkers.PluginId}`;
}

export default class Transform extends Stream.Transform {

    private _logger: Logger;
    private _pluginId: number;
    private _rest: string = '';
    private _streamId: string;
    private _state: State;
    private _streamState: StreamState;
    private _beforeNotifyHandle: TBeforeNotifyHandle | undefined;

    constructor(options: Stream.TransformOptions,
                streamId: string,
                pluginId: number,
                state: State,
                streamState: StreamState,
                beforeNotifyHandle?: TBeforeNotifyHandle) {

        super(options);
        this._streamId = streamId;
        this._pluginId = pluginId;
        this._state = state;
        this._streamState = streamState;
        this._beforeNotifyHandle = beforeNotifyHandle;
        this._logger = new Logger(`ControllerStreamTransformer: ${this._streamId}`);
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
            from: this._state.map.getRowsCount(),
            to: this._state.map.getRowsCount(),
        };
        // Store cursor position
        const bytes = {
            from: this._state.map.getByteLength(),
            to: this._state.map.getByteLength(),
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
            rows: rows,
        };

        const done = () => {
            if (callback !== undefined) {
                callback(undefined, output);
            }
            // Add data into map
            this._state.map.add({ rows: rows, bytes: bytes });
            // Add data in progress
            this._state.pipes.next(size);
            // Trigger notification
            this._notify(bytes);
        };

        if (typeof this._beforeNotifyHandle === 'function') {
            this._beforeNotifyHandle(results).then(() => {
                done();
            }).catch((error: Error) => {
                this._logger.warn(`Error from "beforeNotifyHandle": ${error.message}`);
                done();
            });
        } else {
            done();
        }
        // Return results
        return results;
    }

    public convert(chunk: Buffer | string): ITransformResult {
        return this._transform(chunk, 'utf8', undefined);
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

    private _notify(bytes: IRange) {
        // Send notification to render
        this._state.postman.notification();
        // Trigger event on stream was updated
        this._streamState.getSubject().onStreamUpdated.emit(bytes);
    }

}
