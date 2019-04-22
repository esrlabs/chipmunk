import * as Stream from 'stream';
import { IRange } from './controller.stream.search.map';
import Logger from '../tools/env.logger';
import ServiceElectron, { IPCMessages as IPCElectronMessages } from '../services/service.electron';
import State from './controller.stream.search.state';

export interface ITransformResult {
    output: string;
    bytesSize: number;
    rows: IRange;
}

const Settings = {
    notificationDelayOnStream: 500,             // ms, Delay for sending notifications about stream's update to render (client) via IPC, when stream is blocked
    maxPostponedNotificationMessages: 500,      // How many IPC messages to render (client) should be postponed via timer
};

export function convert(streamId: string, state: State, chunk: Buffer | string): ITransformResult {
    const transform: Transform = new Transform({}, streamId, state);
    return transform.convert(chunk);
}

export default class Transform extends Stream.Transform {

    private _logger: Logger;
    private _rest: string = '';
    private _streamId: string;
    private _state: State;

    constructor(options: Stream.TransformOptions, streamId: string, state: State) {
        super(options);
        this._streamId = streamId;
        this._state = state;
        this._logger = new Logger(`ControllerSearchTransformer: ${this._streamId}`);

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
            from: this._state.map.getRowsCount(),
            to: this._state.map.getRowsCount() + output.split(/[\n\r]/gi).length - 1,
        };
        // Store cursor position
        const bytes = {
            from: this._state.map.getByteLength(),
            to: this._state.map.getByteLength(),
        };
        const size: number = Buffer.byteLength(output, 'utf8');
        rows.to -= 1;
        bytes.to += size - 1;
        this._state.map.add({ rows: rows, bytes: bytes });
        if (callback !== undefined) {
            callback(undefined, output);
        }
        return {
            output: output,
            bytesSize: size,
            rows: rows,
        };
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

}
