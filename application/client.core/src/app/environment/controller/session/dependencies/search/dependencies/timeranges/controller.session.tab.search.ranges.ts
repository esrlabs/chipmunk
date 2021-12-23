import { Observable, Subject, Subscription } from 'rxjs';
import {
    ControllerSessionTabTimestamp,
    IAddRange,
} from '../../../timestamps/session.dependency.timestamps';
import { CommonInterfaces } from '../../../../../../interfaces/interface.common';
import { Importable } from '../../../importer/controller.session.importer.interface';
import {
    RangeRequest,
    RangesStorage,
    IRangeUpdateEvent,
    IRangesStorageUpdated,
    IRangeDescOptional,
} from './controller.session.tab.search.ranges.storage';
import { FilterRequest } from '../filters/controller.session.tab.search.filters.request';
import { CancelablePromise } from 'chipmunk.client.toolkit';
import { IPC } from '../../../../../../services/service.electron.ipc';
import { getColorHolder } from '../../../../../../theme/colors';
import { Dependency, SessionGetter, SearchSessionGetter } from '../search.dependency';

import ServiceElectronIpc from '../../../../../../services/service.electron.ipc';

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
    onExport: Subject<void>;
}

export class ControllerSessionTabSearchRanges
    extends Importable<IRangeDescOptional[]>
    implements Dependency
{
    private _logger: Toolkit.Logger;
    private _guid: string;
    private _storage!: RangesStorage;
    private _subjects: ISubjects = {
        updated: new Subject<RangesStorage>(),
        searching: new Subject<string>(),
        complited: new Subject<string>(),
        onExport: new Subject<void>(),
    };
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private _tasks: Map<string, CancelablePromise<CommonInterfaces.TimeRanges.IRange[]>> =
        new Map();
    private _accessor: {
        session: SessionGetter;
        search: SearchSessionGetter;
    };

    constructor(uuid: string, session: SessionGetter, search: SearchSessionGetter) {
        super();
        this._guid = uuid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSearchRanges: ${uuid}`);
        this._accessor = {
            session,
            search,
        };
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._storage = new RangesStorage(this._guid);
            this._subscriptions.onStorageUpdated = this._storage
                .getObservable()
                .updated.subscribe(this._onStorageUpdated.bind(this));
            this._subscriptions.onStorageChanged = this._storage
                .getObservable()
                .changed.subscribe(this._onStorageChanged.bind(this));
            resolve();
        });
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

    public getName(): string {
        return 'ControllerSessionTabSearchRanges';
    }

    public getGuid(): string {
        return this._guid;
    }

    public getObservable(): {
        updated: Observable<RangesStorage>;
        searching: Observable<string>;
        complited: Observable<string>;
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

    public search(
        range: RangeRequest,
    ): CancelablePromise<CommonInterfaces.TimeRanges.IRange[]> | Error {
        if (this._tasks.has(range.getGUID())) {
            return new Error(`Request for ${range.getGUID()} already exists.`);
        }
        const format: string | undefined =
            this._accessor.session().getTimestamp().getFormats().length === 0
                ? undefined
                : this._accessor.session().getTimestamp().getFormats()[0].format;
        if (format === undefined) {
            return new Error(`No any datetime formats are defined`);
        }
        const task: CancelablePromise<CommonInterfaces.TimeRanges.IRange[]> = new CancelablePromise<
            CommonInterfaces.TimeRanges.IRange[]
        >((resolve, reject) => {
            this._subjects.searching.next(range.getGUID());
            ServiceElectronIpc.request<IPC.TimerangeSearchResponse>(
                new IPC.TimerangeSearchRequest({
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
                }),
                IPC.TimerangeSearchResponse,
            )
                .then((response) => {
                    const getColor: (index: number) => string = getColorHolder(range.getColor());
                    if (response.error !== undefined) {
                        return reject(
                            new Error(
                                this._logger.error(
                                    `search request id ${range.getGUID()} was finished with error: ${
                                        response.error
                                    }`,
                                ),
                            ),
                        );
                    }
                    const ranges: IAddRange[] = [];
                    response.ranges.forEach((item: CommonInterfaces.TimeRanges.IRange) => {
                        const group = this._accessor.session().getTimestamp().getNextGroup();
                        const alias = range.getGUID();
                        item.points.forEach(
                            (point: CommonInterfaces.TimeRanges.IRow, index: number) => {
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
                            },
                        );
                    });
                    this._accessor.session().getTimestamp().removeRange(range.getGUID());
                    this._accessor.session().getTimestamp().addRange(ranges);
                    resolve(response.ranges);
                })
                .catch((error: Error) => {
                    reject(
                        new Error(
                            this._logger.error(
                                `search request id ${range.getGUID()} was finished with error: ${
                                    error.message
                                }`,
                            ),
                        ),
                    );
                })
                .finally(() => {
                    this._subjects.complited.next(range.getGUID());
                });
        })
            .canceled(() => {
                // TODO: send cancel requeest
            })
            .finally(() => {
                this._tasks.delete(range.getGUID());
            });
        this._tasks.set(range.getGUID(), task);
        return task;
    }

    public getExportObservable(): Observable<void> {
        return this._subjects.onExport.asObservable();
    }

    public getImporterUUID(): string {
        return 'timeranges';
    }

    public export(): Promise<IRangeDescOptional[] | undefined> {
        return new Promise((resolve) => {
            if (this._storage.get().length === 0) {
                return resolve(undefined);
            }
            resolve(this._storage.getAsDesc());
        });
    }

    public import(filters: IRangeDescOptional[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this._storage.clear();
            const err: Error | undefined = this._storage.add(filters);
            if (err instanceof Error) {
                reject(err);
            } else {
                resolve();
            }
        });
    }

    private _onStorageUpdated(event: IRangesStorageUpdated | undefined) {
        this._subjects.onExport.next();
    }

    private _onStorageChanged(event: IRangeUpdateEvent) {
        this._subjects.onExport.next();
    }
}
