import * as Stream from 'stream';
import { IRange } from './controller.stream.processor.map';
import * as StreamMarkers from '../consts/stream.markers';
import Logger from '../tools/env.logger';
import ServiceElectron, { IPCMessages as IPCElectronMessages } from '../services/service.electron';
import State from './controller.stream.processor.state';

export interface ITransformResult {
    output: string;
    bytesSize: number;
    rows: IRange;
}

const Settings = {
    notificationDelayOnStream: 500,             // ms, Delay for sending notifications about stream's update to render (client) via IPC, when stream is blocked
    maxPostponedNotificationMessages: 500,      // How many IPC messages to render (client) should be postponed via timer
};

export function convert(streamId: string, pluginId: number, state: State, chunk: Buffer | string): ITransformResult {
    const transform: Transform = new Transform({}, streamId, pluginId, state);
    return transform.convert(chunk);
}

export default class Transform extends Stream.Transform {

    private _logger: Logger;
    private _pluginId: number;
    private _rest: string = '';
    private _streamId: string;
    private _state: State;
    private _notificationTimer: any;
    private _postponedNotifications: number = 0;

    constructor(options: Stream.TransformOptions, streamId: string, pluginId: number, state: State) {
        super(options);
        this._streamId = streamId;
        this._pluginId = pluginId;
        this._state = state;
        this._logger = new Logger(`ControllerStreamTransformer: ${this._streamId}`);

    }

    public _transform(chunk: Buffer | string, encoding: string, callback: Stream.TransformCallback | undefined): ITransformResult {
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
            return `${StreamMarkers.PluginId}${this._pluginId}${StreamMarkers.PluginId}${StreamMarkers.RowNumber}${rows.to++}${StreamMarkers.RowNumber}\n`;
        });
        const size: number = Buffer.byteLength(output, 'utf8');
        rows.to -= 1;
        bytes.to += size - 1;
        this._state.map.add({ rows: rows, bytes: bytes });
        if (callback !== undefined) {
            callback(undefined, output);
        }
        this._notify(size, rows, output);
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

    private _notify(bytesChunkSize: number, rows: IRange, output: string) {
        // Send state information for pipes (if it's needed)
        this._state.pipes.next(bytesChunkSize);
        // Notification of render (client) about stream's update
        clearTimeout(this._notificationTimer);
        // Set new timer for notification message
        if (this._postponedNotifications < Settings.maxPostponedNotificationMessages) {
            this._postponedNotifications += 1;
            this._notificationTimer = setTimeout(() => {
                this._sendNotification(output, rows.from, rows.to);
            }, Settings.notificationDelayOnStream);
        } else {
            this._postponedNotifications = 0;
            this._sendNotification(output, rows.from, rows.to);
        }
    }

    private _sendNotification(complete?: string, from?: number, to?: number): Promise<void> {
        return ServiceElectron.IPC.send(new IPCElectronMessages.StreamUpdated({
            guid: this._streamId,
            length: this._state.map.getByteLength(),
            rowsCount: this._state.map.getRowsCount(),
            addedRowsData: complete === undefined ? '' : complete,
            addedFrom: from === undefined ? -1 : from,
            addedTo: to === undefined ? -1 : to,
        })).catch((error: Error) => {
            this._logger.warn(`Fail send notification to render due error: ${error.message}`);
        });
    }

}
