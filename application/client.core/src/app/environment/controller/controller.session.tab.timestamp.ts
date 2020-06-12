import { Subscription, Subject, Observable } from 'rxjs';
import { IPCMessages } from '../services/service.electron.ipc';
import { CancelablePromise } from 'chipmunk.client.toolkit';

import ElectronIpcService from '../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';
import * as moment from 'moment';

export interface IRow {
    position: number;
    str: string;
    timestamp?: number;
    format?: string;
    match?: string;
}

export interface IRange {
    id: number;
    start: IRow;
    end: IRow | undefined;
    duration: number;
    color: string;
}

export interface IState {
    min: number;
    max: number;
    duration: number;
}

export class ControllerSessionTabTimestamp {

    private _guid: string;
    private _logger: Toolkit.Logger;
    private _tasks: Map<string, CancelablePromise<any, any, any, any>> = new Map();
    private _latest: IPCMessages.TimestampDiscoverResponse | undefined;
    private _regexp: RegExp | undefined;
    private _ranges: IRange[] = [];
    private _state: IState = { min: Infinity, max: -1, duration: 0 };
    private _sequence: number = 0;
    private _open: IRange | undefined;
    private _subjects: {
        change: Subject<IRange>,
        update: Subject<IRange[]>,
    } = {
        change: new Subject(),
        update: new Subject(),
    };

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

    public getObservable(): {
        change: Observable<IRange>,
        update: Observable<IRange[]>,
    } {
        return {
            change: this._subjects.change.asObservable(),
            update: this._subjects.update.asObservable(),
        };
    }

    public getState(): IState {
        return this._state;
    }

    public setPoint(row: IRow) {
        const index: number = this.getOpenRangeIndex();
        const tm: number | undefined = this.getTimestamp(row.str);
        if (tm === undefined) {
            return;
        }
        row.timestamp = tm;
        row.match = this.getMatch(row.str);
        row.format = this._latest.format.format;
        if (index === -1) {
            this._ranges.push({
                id: this._sequence++,
                start: row,
                end: undefined,
                duration: -1,
                color: this._getColor(),
            });
            this._open = this._ranges[this._ranges.length - 1];
            this._setState();
            this._subjects.update.next(this.getRanges());
        } else {
            this._ranges[index].end = row;
            this._ranges[index].duration = Math.abs(this._ranges[index].start.timestamp - this._ranges[index].end.timestamp);
            if (this._ranges[index].end.timestamp < this._ranges[index].start.timestamp) {
                const backup = this._ranges[index].end;
                this._ranges[index].end = this._ranges[index].start;
                this._ranges[index].start = backup;
            }
            this._open = undefined;
            this._setState();
            this._subjects.change.next(Toolkit.copy(this._ranges[index]));
        }
    }

    public getTimestamp(str: string): number | undefined {
        if (this._regexp === undefined) {
            return undefined;
        }
        const match: RegExpMatchArray | null = str.match(this._regexp);
        if (match === null || match.length === 0) {
            return undefined;
        }
        const tm = moment(match[0], this._latest.format.format);
        if (!tm.isValid()) {
            return undefined;
        }
        return tm.toDate().getTime();
    }

    public getMatch(str: string): string | undefined {
        if (this._regexp === undefined) {
            return undefined;
        }
        const match: RegExpMatchArray | null = str.match(this._regexp);
        if (match === null || match.length === 0) {
            return undefined;
        }
        return match[0];
    }

    public discover(update: boolean = false): CancelablePromise<IPCMessages.TimestampDiscoverResponse> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<IPCMessages.TimestampDiscoverResponse> = new CancelablePromise<IPCMessages.TimestampDiscoverResponse>(
            (resolve, reject, cancel, refCancelCB, self) => {
            if (this._latest !== undefined && !update) {
                return resolve(Object.assign({}, this._latest));
            }
            this._latest = undefined;
            this._regexp = undefined;
            ElectronIpcService.request(new IPCMessages.TimestampDiscoverRequest({
                session: this._guid,
                id: id,
            }), IPCMessages.TimestampDiscoverResponse).then((response: IPCMessages.TimestampDiscoverResponse) => {
                if (typeof response.error === 'string') {
                    this._logger.error(`Fail to discover files due error: ${response.error}`);
                    return reject(new Error(response.error));
                }
                if (response.format !== undefined) {
                    this._latest = Object.assign({}, response);
                    const regexp: RegExp | Error = Toolkit.regTools.createFromStr(this._latest.format.regex, this._latest.format.flags.join(''));
                    this._regexp = regexp instanceof Error ? undefined : regexp;
                }
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

    public getOpenRangeIndex(): number {
        return this._ranges.findIndex((r: IRange) => {
            return r.end === undefined;
        });
    }

    public getOpenRangeStart(): number | undefined {
        return this._open === undefined ? undefined : this._open.start.timestamp;
    }

    public getRanges(): IRange[] {
        return this._ranges.map((r: IRange) => {
            return Toolkit.copy(r);
        });
    }

    public getCount(): number {
        return this._ranges.length;
    }

    public getRangeColorFor(position: number): string | undefined {
        let color: string | undefined;
        this._ranges.forEach((r: IRange) => {
            if (color !== undefined) {
                return;
            }
            if (r.start.position === position) {
                color = r.color;
            } else if (r.end !== undefined && r.start.position < r.end.position && r.start.position <= position && r.end.position >= position) {
                color = r.color;
            } else if (r.end !== undefined && r.start.position > r.end.position && r.start.position >= position && r.end.position <= position) {
                color = r.color;
            }
        });
        return color;
    }

    public injectHighlight(str: string): string {
        if (this._open === undefined) {
            return str;
        }
        if (this._regexp === undefined) {
            return str;
        }
        const tm: number | undefined = this.getTimestamp(str);
        return str.replace(this._regexp, (_match: string) => {
            return `<span class="timestampmatch" data-duration="${tm === undefined ? '-' : Math.abs(tm - this._open.start.timestamp)}">${_match}</span>`;
        });
    }

    private _getColor(): string {
        return `rgb(${Math.round(Math.random() * 154) + 100}, ${Math.round(Math.random() * 154) + 100}, ${Math.round(Math.random() * 154) + 100})`;
    }

    private _setState() {
        this._state = { min: Infinity, max: -1, duration: 0 };
        this._ranges.forEach((r: IRange) => {
            if (this._state.min > r.start.timestamp) {
                this._state.min = r.start.timestamp;
            }
            if (this._state.max < r.start.timestamp) {
                this._state.max = r.start.timestamp;
            }
            if (r.end !== undefined) {
                if (this._state.min > r.end.timestamp) {
                    this._state.min = r.end.timestamp;
                }
                if (this._state.max < r.end.timestamp) {
                    this._state.max = r.end.timestamp;
                }
            }
        });
        this._state.duration = Math.abs(this._state.min - this._state.max);
    }

}
