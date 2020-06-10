import { Subscription, Subject, Observable } from 'rxjs';
import { IPCMessages } from '../services/service.electron.ipc';
import { ControllerSessionTab } from '../controller/controller.session.tab';
import { CancelablePromise } from 'chipmunk.client.toolkit';

import SessionsService from '../services/service.sessions.tabs';
import EventsHubService from '../services/standalone/service.eventshub';
import ElectronIpcService from '../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IRow {
    position: number;
    str: string;
    timestamp: number;
}

export interface IRange {
    start: IRow;
    end: IRow | undefined;
}

export class ControllerSessionTabTimestamp {

    private _guid: string;
    private _logger: Toolkit.Logger;
    private _tasks: Map<string, CancelablePromise<any, any, any, any>> = new Map();
    private _latest: IPCMessages.TimestampDiscoverResponse | undefined;
    private _ranges: IRange[] = [];

    constructor(guid: string) {
        this._guid = guid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabTimestamp: ${guid}`);
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._tasks.size === 0) {
                this._logger.debug(`No active tasks; no need to abort any.`);
                return resolve();
            }
            Promise.all(Array.from(this._tasks.values()).map((task: CancelablePromise<any, any, any, any>) => {
                return new Promise((resolveTask) => {
                    task.canceled(resolveTask);
                    task.abort('Controller is going to be destroyed');
                });
            })).then(() => {
                resolve();
                this._logger.debug(`All tasks are aborted; controller is destroyed.`);
            }).catch((err: Error) => {
                this._logger.error(`Unexpected error during destroying: ${err.message}`);
                reject(err);
            });
        });
    }

    public discover(update: boolean = false): CancelablePromise<IPCMessages.TimestampDiscoverResponse> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<IPCMessages.TimestampDiscoverResponse> = new CancelablePromise<IPCMessages.TimestampDiscoverResponse>(
            (resolve, reject, cancel, refCancelCB, self) => {
            if (this._latest !== undefined && !update) {
                return resolve(Object.assign({}, this._latest));
            }
            ElectronIpcService.request(new IPCMessages.TimestampDiscoverRequest({
                session: this._guid,
                id: id,
            }), IPCMessages.TimestampDiscoverResponse).then((response: IPCMessages.TimestampDiscoverResponse) => {
                if (typeof response.error === 'string') {
                    this._logger.error(`Fail to discover files due error: ${response.error}`);
                    return reject(new Error(response.error));
                }
                this._latest = Object.assign({}, response);
                resolve(response);
            }).catch((disErr: Error) => {
                this._logger.error(`Fail to discover files due error: ${disErr.message}`);
                return reject(disErr);
            });
        }).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

    public test(format: string): CancelablePromise<IPCMessages.TimestampTestResponse> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<IPCMessages.TimestampTestResponse> = new CancelablePromise<IPCMessages.TimestampTestResponse>(
            (resolve, reject, cancel, refCancelCB, self) => {
            ElectronIpcService.request(new IPCMessages.TimestampTestRequest({
                session: this._guid,
                format: format,
                id: id,
            }), IPCMessages.TimestampTestResponse).then((response: IPCMessages.TimestampTestResponse) => {
                if (typeof response.error === 'string') {
                    this._logger.error(`Fail to test files due error: ${response.error}`);
                    return reject(new Error(response.error));
                }
                resolve(response);
            }).catch((disErr: Error) => {
                this._logger.error(`Fail to test files due error: ${disErr.message}`);
                return reject(disErr);
            });
        }).finally(() => {
            this._tasks.delete(id);
        });
        this._tasks.set(id, task);
        return task;
    }

    public isDetected(): boolean {
        return this._latest !== undefined;
    }

    public hasOpenRange(): boolean {
        return this._ranges.find((range: IRange) => {
            return range.end === undefined;
        }) !== undefined;
    }

    public getOpenRangeStart(): number | undefined {
        const range: IRange | undefined = this._ranges.find((r: IRange) => {
            return r.end === undefined;
        });
        return range === undefined ? undefined : range.start.timestamp;
    }

}
