import { Observable, Subject, Subscription } from 'rxjs';
import { ControllerSessionTabTimestamp, IAddRange } from './controller.session.tab.timestamps';
import { CommonInterfaces } from '../interfaces/interface.common';
import {
    RangeRequest,
    RangesStorage,
    IRangeUpdateEvent,
    IRangesStorageUpdated,
    IUpdateEvent,
} from './controller.session.tab.search.ranges.storage';
import { FilterRequest } from './controller.session.tab.search.filters.request';
import { CancelablePromise } from 'chipmunk.client.toolkit';
import { IPCMessages } from '../services/service.electron.ipc';
import { shadeColor, getColorHolder } from '../theme/colors';
import ServiceElectronIpc from '../services/service.electron.ipc';
import OutputParsersService from '../services/standalone/service.output.parsers';

import * as Toolkit from 'chipmunk.client.toolkit';

export { RangeRequest, RangesStorage };

export interface IControllerSessionTabSearchRanges {
    guid: string;
    timestamp: ControllerSessionTabTimestamp;
}

export interface ISubjects {
    updated: Subject<RangesStorage>;
    searching: Subject<string>;
    complited: Subject<string>;
}

export class ControllerSessionTabSearchRanges {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _storage: RangesStorage;
    private _subjects: ISubjects = {
        updated: new Subject<RangesStorage>(),
        searching: new Subject<string>(),
        complited: new Subject<string>(),
    };
    private _timestamp: ControllerSessionTabTimestamp;
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = { };
    private _tasks: Map<string, CancelablePromise<CommonInterfaces.TimeRanges.IRange[]>> = new Map();

    constructor(params: IControllerSessionTabSearchRanges) {
        this._guid = params.guid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchRanges: ${params.guid}`);
        this._storage = new RangesStorage(params.guid);
        this._timestamp = params.timestamp;
        this._subscriptions.onStorageUpdated = this._storage.getObservable().updated.subscribe(this._onStorageUpdated.bind(this));
        this._subscriptions.onStorageChanged = this._storage.getObservable().changed.subscribe(this._onStorageChanged.bind(this));
    }

    public destroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            this._tasks.forEach((task: CancelablePromise<CommonInterfaces.TimeRanges.IRange[]>) => {
                task.abort();
            });
            this._storage.destroy().then(() => {
                resolve();
            });
        });
    }

    public getGuid(): string {
        return this._guid;
    }

    public getObservable(): {
        updated: Observable<RangesStorage>,
        searching: Observable<string>,
        complited: Observable<string>,
    } {
        return {
            updated: this._subjects.updated.asObservable(),
            searching: this._subjects.searching.asObservable(),
            complited: this._subjects.complited.asObservable(),
        };
    }

    public getStorage(): RangesStorage {
        return this._storage;
    }

    public search(range: RangeRequest): CancelablePromise<CommonInterfaces.TimeRanges.IRange[]> | Error {
        if (this._tasks.has(range.getGUID())) {
            return new Error(`Request for ${range.getGUID()} already exists.`);
        }
        const format: string | undefined = this._timestamp.getFormats().length === 0 ? undefined : this._timestamp.getFormats()[0].format;
        if (format === undefined) {
            return new Error(`No any datetime formats are defined`);
        }
        const task: CancelablePromise<CommonInterfaces.TimeRanges.IRange[]> = new CancelablePromise<CommonInterfaces.TimeRanges.IRange[]>((resolve, reject) => {
            this._subjects.searching.next(range.getGUID());
            ServiceElectronIpc.request(new IPCMessages.TimerangeSearchRequest({
                session: this._guid,
                id: range.getGUID(),
                points: range.getPoints().map((filter: FilterRequest) => {
                    return {
                        request: filter.asDesc().request,
                        flags: filter.asDesc().flags,
                    };
                }),
                strict: range.getStrictState(),
                format: format,
                replacements: {},
            }), IPCMessages.TimerangeSearchResponse).then((response: IPCMessages.TimerangeSearchResponse) => {
                const getColor: (index: number) => string = getColorHolder(range.getColor());
                if (response.error !== undefined) {
                    return reject(new Error(this._logger.error(`search request id ${range.getGUID()} was finished with error: ${response.error}`)));
                }
                const ranges: IAddRange[] = [];
                response.ranges.forEach((item) => {
                    const group = this._timestamp.getNextGroup();
                    const alias = range.getGUID();
                    item.points.forEach((point, index) => {
                        if (item.points[index + 1] === undefined) {
                            return;
                        }
                        const next = item.points[index + 1];
                        ranges.push({
                            from: {
                                str: point.str,
                                position: point.position,
                                timestamp: point.timestamp,
                            },
                            to: {
                                str: next.str,
                                position: next.position,
                                timestamp: next.timestamp,
                            },
                            options: {
                                alias: alias,
                                group: group,
                                color: getColor(index),
                            },
                        });
                    });
                });
                this._timestamp.removeRange(range.getGUID());
                this._timestamp.addRange(ranges);
                resolve(response.ranges);
            }).catch((error: Error) => {
                reject(new Error(this._logger.error(`search request id ${range.getGUID()} was finished with error: ${error.message}`)));
            }).finally(() => {
                this._subjects.complited.next(range.getGUID());
            });
        }).canceled(() => {
            // TODO: send cancel requeest
        }).finally(() => {
            this._tasks.delete(range.getGUID());
        });
        this._tasks.set(range.getGUID(), task);
        return task;
    }

    private _onStorageUpdated(event: IRangesStorageUpdated | undefined) {
    }

    private _onStorageChanged(event: IRangeUpdateEvent) {

    }

}
