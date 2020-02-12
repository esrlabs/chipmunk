import ServiceElectron, { IPCMessages as IPCElectronMessages, Subscription } from '../../services/service.electron';
import Logger from '../../tools/env.logger';
import ControllerStreamFileReader from '../stream.main/file.reader';
import ControllerStreamProcessor from '../stream.main/controller';
import State from './state';
import { EventsHub } from '../stream.common/events';
import { ChartingEngine, TChartData, IMatch, IChartRequest } from './engine/controller';
import * as Tools from '../../tools/index';
import { IMapItem } from '../stream.main/file.map';

export interface IRange {
    from: number;
    to: number;
}

export interface IRangeMapItem {
    rows: IRange;
    bytes: IRange;
}

export default class ControllerStreamCharts {

    private _logger: Logger;
    private _reader: ControllerStreamFileReader;
    private _subscriptions: { [key: string ]: Subscription | undefined } = { };
    private _state: State;
    private _charting: ChartingEngine;
    private _events: EventsHub;
    private _processor: ControllerStreamProcessor;
    private _charts: IChartRequest[] = [];
    private _pending: {
        bytesToRead: IRange,
        rowOffset: number,
    } = {
        bytesToRead: { from: -1, to: -1 },
        rowOffset: -1,
    };

    constructor(guid: string, streamFile: string, searchFile: string, stream: ControllerStreamProcessor, streamState: EventsHub) {
        this._events = streamState;
        this._processor = stream;
        // Create controllers
        this._state = new State(guid, streamFile, searchFile);
        this._logger = new Logger(`ControllerStreamCharts: ${this._state.getGuid()}`);
        this._charting = new ChartingEngine(this._state);
        this._reader = new ControllerStreamFileReader(this._state.getGuid(), this._state.getStreamFile());
        // Listen stream update event
        this._subscriptions.onStreamBytesMapUpdated = this._events.getSubject().onStreamBytesMapUpdated.subscribe(this._stream_onUpdate.bind(this));
        // Listen IPC messages
        ServiceElectron.IPC.subscribe(IPCElectronMessages.ChartRequest, this._ipc_onChartRequest.bind(this)).then((subscription: Subscription) => {
            this._subscriptions.ChartRequest = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "ChartRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
        });
        ServiceElectron.IPC.subscribe(IPCElectronMessages.ChartRequestCancelRequest, this._ipc_onChartRequestCancelRequest.bind(this)).then((subscription: Subscription) => {
            this._subscriptions.ChartRequestCancelRequest = subscription;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to subscribe to render event "ChartRequestCancelRequest" due error: ${error.message}. This is not blocked error, loading will be continued.`);
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Unsubscribe IPC messages / events
            Object.keys(this._subscriptions).forEach((key: string) => {
                (this._subscriptions as any)[key].destroy();
            });
            // Clear results file
            this._clear().catch((error: Error) => {
                this._logger.error(`Error while killing: ${error.message}`);
            }).finally(() => {
                // Kill executor
                this._charting.destroy();
                // Kill reader
                this._reader.destroy();
                // Done
                resolve();
            });
        });
    }

    private _extract(charts: IChartRequest[], requestId: string, from?: number, to?: number, rowOffset?: number): Promise<TChartData> {
        return new Promise((resolve, reject) => {
            if (this._processor.getStreamSize() === 0) {
                // Save requests
                this._charts = charts;
                // Stream file doesn't exist yet
                return resolve({});
            }
            // Start inspecting
            const inspecting = this._charting.extract(charts, from, to, rowOffset);
            if (inspecting instanceof Error) {
                this._logger.warn(`Fail to start extract chart data due error: ${inspecting.message}`);
                return;
            }
            inspecting.then((data: TChartData) => {
                this._charts = charts;
                resolve(data);
            }).catch((execErr: Error) => {
                reject(execErr);
                this._logger.warn(`Fail to make extract chart data due error: ${execErr.message}`);
            });
        });
    }

    private _append(updated?: IMapItem): void {
        if (this._charts.length === 0) {
            return;
        }
        if (updated !== undefined) {
            if (this._pending.rowOffset === -1) {
                this._pending.rowOffset = updated.rows.from;
            }
            if (this._pending.bytesToRead.from === -1 || this._pending.bytesToRead.from > updated.bytes.from) {
                this._pending.bytesToRead.from = updated.bytes.from;
            }
            if (this._pending.bytesToRead.to === -1 || this._pending.bytesToRead.to < updated.bytes.to) {
                this._pending.bytesToRead.to = updated.bytes.to;
            }
        }
        if (this._charting.isWorking()) {
            return;
        }
        const bytes: IRange = { from: this._pending.bytesToRead.from, to: this._pending.bytesToRead.to };
        const rowsOffset: number = this._pending.rowOffset;
        this._pending.bytesToRead = { from: -1, to: -1 };
        this._pending.rowOffset = -1;
        this._extract(this._charts, Tools.guid(), bytes.from, bytes.to, rowsOffset).then((data: TChartData) => {
            ServiceElectron.IPC.send(new IPCElectronMessages.ChartResultsUpdated({
                streamId: this._state.getGuid(),
                results: data,
            })).catch((sendMsgErr: Error) => {
                this._logger.error(`Fail notify render due error: ${sendMsgErr.message}`);
            });
        }).catch((searchErr: Error) => {
            this._logger.warn(`Fail to append search results (range: ${bytes.from} - ${bytes.to}) due error: ${searchErr.message}`);
        }).finally(() => {
            this._reappend();
        });
    }

    private _reappend() {
        if (this._pending.bytesToRead.from !== -1 && this._pending.bytesToRead.to !== -1) {
            this._append();
        }
    }

    private _clear(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Cancel current task if exist
            this._charting.cancel();
            resolve();
        });
    }

    private _ipc_onChartRequest(message: IPCElectronMessages.TMessage, response: (instance: any) => any) {
        const request: IPCElectronMessages.ChartRequest = message as IPCElectronMessages.ChartRequest;
        // Store starting tile
        const started: number = Date.now();
        // Check target stream
        if (this._state.getGuid() !== request.streamId) {
            return;
        }
        // Check count of requests
        if (request.requests.length === 0) {
            return this._ipc_chartResultsResponse(response, {
                id: request.requestId,
                started: started,
                results: {},
            });
        }
        // Clear results file
        this._clear().then(() => {
            // Create regexps
            const requests: IChartRequest[] = request.requests.map((regInfo: IPCElectronMessages.IChartRegExpStr) => {
                return {
                    regExp: new RegExp(regInfo.source, regInfo.flags),
                    groups: regInfo.groups,
                };
            });
            this._extract(requests, request.requestId).then((data: TChartData) => {
                // Responce with results
                this._ipc_chartResultsResponse(response, {
                    id: request.requestId,
                    started: started,
                    results: data,
                });
            }).catch((searchErr: Error) => {
                return this._ipc_chartResultsResponse(response, {
                    id: request.requestId,
                    started: started,
                    error: searchErr.message,
                });
            });
        }).catch((droppingErr: Error) => {
            this._logger.error(`Fail drop search file due error: ${droppingErr.message}`);
            return this._ipc_chartResultsResponse(response, {
                id: request.requestId,
                started: started,
                error: droppingErr.message,
            });
        });
    }

    private _ipc_chartResultsResponse(response: (instance: any) => any, res: {
        id: string, started: number, error?: string, results?: TChartData,
    }) {
        response(new IPCElectronMessages.ChartRequestResults({
            streamId: this._state.getGuid(),
            requestId: res.id,
            error: res.error,
            results: res.results === undefined ? {} : res.results,
            duration: Date.now() - res.started,
        }));
    }

    private _ipc_onChartRequestCancelRequest(message: IPCElectronMessages.TMessage, response: (instance: any) => any) {
        const request: IPCElectronMessages.ChartRequestCancelRequest = message as IPCElectronMessages.ChartRequestCancelRequest;
        // Clear results file
        this._clear().then(() => {
            response(new IPCElectronMessages.ChartRequestCancelResponse({
                streamId: this._state.getGuid(),
                requestId: request.requestId,
            }));
        }).catch((error: Error) => {
            response(new IPCElectronMessages.ChartRequestCancelResponse({
                streamId: this._state.getGuid(),
                requestId: request.requestId,
                error: error.message,
            }));
        });
    }

    private _stream_onUpdate(map: IMapItem) {
        this._append(map);
    }

}
