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
    match?: string;
}

export interface IRange {
    id: number;
    start: IRow;
    end: IRow | undefined;
    duration: number;
    color: string;
    group: number;
}

export interface IState {
    min: number;
    max: number;
    duration: number;
}

export interface IFormat {
    format: string;
    regexp: RegExp;
}

export class ControllerSessionTabTimestamp {

    private _guid: string;
    private _logger: Toolkit.Logger;
    private _tasks: Map<string, CancelablePromise<any, any, any, any>> = new Map();
    private _format: IFormat[] = [];
    private _ranges: IRange[] = [];
    private _state: IState = { min: Infinity, max: -1, duration: 0 };
    private _sequence: number = 0;
    private _open: IRange | undefined;
    private _subjects: {
        change: Subject<IRange>,
        update: Subject<IRange[]>,
        formats: Subject<void>,
    } = {
        change: new Subject(),
        update: new Subject(),
        formats: new Subject(),
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
        formats: Observable<void>,
    } {
        return {
            change: this._subjects.change.asObservable(),
            update: this._subjects.update.asObservable(),
            formats: this._subjects.formats.asObservable(),
        };
    }

    public getState(): IState {
        return this._state;
    }

    public getFormats(): IFormat[] {
        return this._format.map((format: IFormat) => {
            return { format: format.format, regexp: format.regexp };
        });
    }

    public setPoint(row: IRow) {
        const index: number = this.getOpenRangeIndex();
        const tm: number | undefined = this.getTimestamp(row.str);
        if (tm === undefined) {
            return;
        }
        row.timestamp = tm;
        row.match = this.getMatch(row.str);
        if (index === -1) {
            this._ranges.push({
                id: this._sequence++,
                start: row,
                end: undefined,
                duration: -1,
                color: this._getColor(),
                group: this._sequence++,
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

    public addRange(start: IRow, end: IRow) {
        start.timestamp = this.getTimestamp(start.str);
        end.timestamp = this.getTimestamp(end.str);
        if (start.timestamp === undefined || end.timestamp === undefined) {
            return;
        }
        const group: number | undefined = this.getOpenRangeGroup();
        [start, end].forEach((row: IRow) => {
            row.match = this.getMatch(row.str);
        });
        if (end.timestamp < start.timestamp) {
            const backup = end;
            end = start;
            start = backup;
        }
        this._ranges.push({
            id: this._sequence++,
                start: start,
                end: end,
                duration: Math.abs(end.timestamp - start.timestamp),
                color: this._getColor(),
                group: group === undefined ? this._sequence++ : group,
        });
        this._setState();
        this._subjects.update.next(this.getRanges());
    }

    public dropOpenRange() {
        const index: number | undefined = this.getOpenRangeIndex();
        if (index === undefined) {
            return;
        }
        this._ranges.splice(index, 1);
        this._open = undefined;
        this._setState();
        this._subjects.update.next(this.getRanges());
    }

    public drop(exceptions: number[] = []) {
        this._ranges = this._ranges.filter((row: IRange) => {
            return exceptions.indexOf(row.id) !== -1;
        });
        this._open = undefined;
        this._setState();
        this._subjects.update.next(this.getRanges());
    }

    public getTimestamp(str: string): number | undefined {
        let tm: any;
        this._format.forEach((format: IFormat) => {
            if (tm !== undefined) {
                return;
            }
            const match: RegExpMatchArray | null = str.match(format.regexp);
            if (match === null || match.length === 0) {
                return undefined;
            }
            tm = moment(match[0], format.format);
            if (!tm.isValid()) {
                tm = undefined;
            }
        });
        return tm === undefined ? undefined : tm.toDate().getTime();
    }

    public getMatch(str: string): string | undefined {
        let match: string | undefined;
        this._format.forEach((format: IFormat) => {
            if (match !== undefined) {
                return;
            }
            const matches: RegExpMatchArray | null = str.match(format.regexp);
            if (matches === null || matches.length === 0) {
                return undefined;
            }
            match = matches[0];
        });
        return match;
    }

    public discover(update: boolean = false): CancelablePromise<void> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<void> = new CancelablePromise<void>(
            (resolve, reject, cancel, refCancelCB, self) => {
            if (this._format.length > 0 && !update) {
                return resolve();
            }
            this._format = [];
            ElectronIpcService.request(new IPCMessages.TimestampDiscoverRequest({
                session: this._guid,
                id: id,
            }), IPCMessages.TimestampDiscoverResponse).then((response: IPCMessages.TimestampDiscoverResponse) => {
                if (typeof response.error === 'string') {
                    this._logger.error(`Fail to discover files due error: ${response.error}`);
                    return reject(new Error(response.error));
                }
                if (response.format === undefined) {
                    return reject(new Error(`Format isn't detected.`));
                }
                const regexp: RegExp | Error = Toolkit.regTools.createFromStr(response.format.regex, response.format.flags.join(''));
                if (regexp instanceof Error) {
                    this._logger.warn(`Fail convert "${response.format.regex}" to RegExp due error: ${regexp.message}`);
                    return reject(regexp);
                }
                this._format.push({
                    format: response.format.format,
                    regexp: regexp,
                });
                this._subjects.formats.next();
                resolve();
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

    public validate(format: string): CancelablePromise<RegExp> {
        const id: string = Toolkit.guid();
        const task: CancelablePromise<RegExp> = new CancelablePromise<RegExp>(
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
                const regexp: RegExp | Error = Toolkit.regTools.createFromStr(response.format.regex, response.format.flags.join(''));
                if (regexp instanceof Error) {
                    this._logger.warn(`Fail convert "${response.format.regex}" to RegExp due error: ${regexp.message}`);
                    return reject(regexp);
                }
                resolve(regexp);
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
        return this._format.length > 0;
    }

    public getRangeIdByPosition(position: number): number {
        let id: number | undefined;
        this._ranges.forEach((r: IRange) => {
            if (id !== undefined) {
                return;
            }
            if (r.start.position === position) {
                id = r.id;
            } else if (r.end !== undefined && r.start.position < r.end.position && r.start.position <= position && r.end.position >= position) {
                id = r.id;
            } else if (r.end !== undefined && r.start.position > r.end.position && r.start.position >= position && r.end.position <= position) {
                id = r.id;
            }
        });
        return id;
    }

    public getOpenRangeIndex(): number {
        return this._ranges.findIndex((r: IRange) => {
            return r.end === undefined;
        });
    }

    public getOpenRangeStart(): number | undefined {
        return this._open === undefined ? undefined : this._open.start.timestamp;
    }

    public getOpenRangePosition(): number | undefined {
        return this._open === undefined ? undefined : this._open.start.position;
    }

    public getOpenRangeGroup(): number | undefined {
        return this._open === undefined ? undefined : this._open.group;
    }

    public getOpenRangeRow(): IRow | undefined {
        return this._open === undefined ? undefined : Object.assign({}, this._open.start);
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
        this._format.forEach((format: IFormat) => {
            const tm: number | undefined = this.getTimestamp(str);
            str = str.replace(format.regexp, (_match: string) => {
                return `<span class="timestampmatch" data-duration="${tm === undefined ? '-' : Math.abs(tm - this._open.start.timestamp)}">${_match}</span>`;
            });
        });
        return str;
    }

    public removeFormatDef(format: string) {
        this._format = this._format.filter(f => f.format !== format);
        this._subjects.formats.next();
    }

    public addFormat(format: IFormat) {
        this._format.push(format);
        this._subjects.formats.next();
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
