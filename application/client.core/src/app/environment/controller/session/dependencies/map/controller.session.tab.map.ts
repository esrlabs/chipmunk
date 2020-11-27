import { Subject, Observable, Subscription } from 'rxjs';
import ServiceElectronIpc, { IPCMessages, Subscription as IPCSubscription } from '../../../../services/service.electron.ipc';
import { ControllerSessionTabSearch } from '../search/controller.session.tab.search';
import { FilterRequest, IFilterUpdateEvent } from '../search/dependencies/filters/controller.session.tab.search.filters.storage';
import { ControllerSessionTabStream } from '../stream/controller.session.tab.stream';
import { IPositionData } from '../output/controller.session.tab.stream.output';
import { Lock } from '../../../helpers/lock';
import { Dependency, SessionGetter } from '../session.dependency';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IMapPoint {
    column: number;
    position: number;
    color: string;
    description: string;
    reg?: string;
    regs?: string[];
}

export interface IMapState {
    count: number;
    position: number;
    rowsInView: number;
    points: IMapPoint[];
}

export interface IControllerSessionTabMap {
    guid: string;
    search: ControllerSessionTabSearch;
    stream: ControllerSessionTabStream;
}

export interface IColumn {
    guid: string;
    description: string;
    search: boolean;
    index: number;
}

const CSettings = {
    columnWideWidth: 16,
    columnNarroweWidth: 8,
    minMarkerHeight: 1,
};

const CMatchesKey = '$__{matches}__$';

export class ControllerSessionTabMap implements Dependency {

    private _guid: string;
    private _logger: Toolkit.Logger;
    private _state: IMapState = {
        count: 0,
        position: 0,
        rowsInView: 0,
        points: [],
    };
    private _subscriptions: { [key: string]: IPCSubscription | Subscription } = {};
    private _columns: { [key: string]: IColumn } = {};
    private _indexes: {[key: string]: number } = {};
    private _searchExpanded: boolean = false;
    private _width: number = CSettings.columnNarroweWidth;
    private _lock: Lock = new Lock();
    private _subjects: {
        onStateUpdate: Subject<IMapState>,
        onPositionUpdate: Subject<IMapState>,
        onRepaint: Subject<void>,
        onRepainted: Subject<void>,
        onRestyle: Subject<FilterRequest>,
    } = {
        onStateUpdate: new Subject(),
        onPositionUpdate: new Subject(),
        onRepaint: new Subject(),
        onRepainted: new Subject(),
        onRestyle: new Subject(),
    };
    private _session: SessionGetter;

    constructor(uuid: string, getter: SessionGetter) {
        this._guid = uuid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabMap: ${this._guid}`);
        this._session = getter;
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._subscriptions.SearchResultMap = ServiceElectronIpc.subscribe(IPCMessages.SearchResultMap, this._ipc_SearchResultMap.bind(this));
            this._subscriptions.StreamUpdated = ServiceElectronIpc.subscribe(IPCMessages.StreamUpdated, this._ipc_onStreamUpdated.bind(this));
            this._subscriptions.onSearchDropped = this._session().getSessionSearch().getFiltersAPI().getObservable().dropped.subscribe(this._onSearchDropped.bind(this));
            this._subscriptions.onSearchStarted = this._session().getSessionSearch().getFiltersAPI().getObservable().searching.subscribe(this._onSearchStarted.bind(this));
            this._subscriptions.onPositionChanged = this._session().getStreamOutput().getObservable().onPositionChanged.subscribe(this._onPositionChanged.bind(this));
            this._subscriptions.onFiltersStyleUpdate = this._session().getSessionSearch().getFiltersAPI().getStorage().getObservable().changed.subscribe(this._onFiltersStyleUpdate.bind(this));
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            resolve();
        });
    }

    public getName(): string {
        return 'ControllerSessionTabMap';
    }

    public getGuid(): string {
        return this._guid;
    }

    public getState(): IMapState {
        return this._state;
    }

    public getObservable(): {
        onStateUpdate: Observable<IMapState>,
        onPositionUpdate: Observable<IMapState>,
        onRepaint: Observable<void>,
        onRepainted: Observable<void>,
        onRestyle: Observable<FilterRequest>,
    } {
        return {
            onStateUpdate: this._subjects.onStateUpdate.asObservable(),
            onPositionUpdate: this._subjects.onPositionUpdate.asObservable(),
            onRepaint: this._subjects.onRepaint.asObservable(),
            onRepainted: this._subjects.onRepainted.asObservable(),
            onRestyle: this._subjects.onRestyle.asObservable(),
        };
    }

    public getColumnsCount(): number {
        if (this._state.points.length === 0) {
            return 0;
        }
        return Object.keys(this._columns).length;
    }

    public toggleColumnWidth() {
        this._width = this.isColumnsWide() ? CSettings.columnNarroweWidth : CSettings.columnWideWidth;
    }

    public repainted() {
        this._subjects.onRepainted.next();
    }

    public isExpanded(): boolean {
        return this._searchExpanded;
    }

    public toggleExpanding() {
        this._searchExpanded = !this._searchExpanded;
        // Remove search colums
        this._cleanColumns();
        // Remap all points
        this._indexes = {};
        let index: number = 0;
        if (this._searchExpanded) {
            this._state.points = this._state.points.map((point: IMapPoint) => {
                if (point.reg === undefined) {
                    return point;
                }
                if (this._indexes[point.reg] === undefined) {
                    this._indexes[point.reg] = index;
                    this._columns[point.reg] = {
                        description: point.reg,
                        index: index,
                        search: true,
                        guid: Toolkit.guid(),
                    };
                    index += 1;
                }
                point.column = this._indexes[point.reg];
                return point;
            });
        } else {
            this._state.points = this._state.points.map((point: IMapPoint) => {
                if (point.reg === undefined) {
                    return point;
                }
                point.column = index;
                return point;
            });
            this._columns[CMatchesKey] = {
                description: 'Matches',
                index: index,
                search: true,
                guid: Toolkit.guid(),
            };
        }
        // Trigger event
        this._saveTriggerStateUpdate();
    }

    public getSettings(): {
        columnWideWidth: number,
        columnNarroweWidth: number,
        minMarkerHeight: number,
    } {
        return CSettings;
    }

    public isColumnsWide(): boolean {
        return this._width === CSettings.columnWideWidth;
    }

    public getColumnWidth(): number {
        return this._width;
    }

    public getClosedMatchRow(row: number): { index: number, position: number } | undefined {
        if (this._state.points.length === 0) {
            return;
        }
        if (isNaN(row) || !isFinite(row)) {
            this._logger.warn(`Value of target row is incorrect.`);
        }
        const target: { index: number, position: number } = { index: 0, position: this._state.points[0].position };
        let distance: number = Math.abs(row - target.position);
        this._state.points.forEach((point: IMapPoint, i: number) => {
            const _distance: number = Math.abs(row - point.position);
            if (_distance < distance) {
                distance = _distance;
                target.position = point.position;
                target.index = i;
            }
        });
        return target;
    }

    private _cleanColumns() {
        Object.keys(this._columns).forEach((key: string) => {
            if (this._columns[key].search) {
                delete this._columns[key];
            }
        });
    }

    private _onFiltersStyleUpdate(event: IFilterUpdateEvent) {
        if (!event.updated.colors) {
            return;
        }
        this._subjects.onRestyle.next(event.filter);
    }

    private _onSearchDropped() {
        // Lock update workflow
        this._lock.lock();
        // Drop points
        this._dropSearchColumns();
        // Remove search colums
        this._cleanColumns();
        // Trigger event
        this._saveTriggerStateUpdate();
    }

    private _onSearchStarted() {
        // Unlock update workflow
        this._lock.unlock();
    }

    private _onPositionChanged(position: IPositionData) {
        this._state.position = position.start;
        this._state.rowsInView = position.count;
        // Trigger event
        this._subjects.onPositionUpdate.next(this._state);
    }

    private _dropSearchColumns() {
        // Get columns to be reset
        const toBeReset: number[] = [];
        Object.keys(this._columns).forEach((key: string) => {
            if (this._columns[key].search) {
                toBeReset.push(this._columns[key].index);
            }
        });
        // Reset columns
        this._state.points = this._state.points.filter(p => toBeReset.indexOf(p.column) === -1);
    }

    private _saveTriggerStateUpdate() {
        this._subjects.onStateUpdate.next({
            count: this._state.count,
            position: this._state.position,
            rowsInView: this._state.rowsInView,
            points: this._state.points,
        });
    }

    private _ipc_SearchResultMap(message: IPCMessages.SearchResultMap) {
        if (message.streamId !== this._guid) {
            return;
        }
        if (this._lock.isLocked()) {
            // Update workflow is locked
            return;
        }
        if (!message.append) {
            this._dropSearchColumns();
        }
        if (!message.append || !this._searchExpanded) {
            this._cleanColumns();
            this._indexes = {};
        }
        const map: { [key: string]: FilterRequest } = {};
        this._session().getSessionSearch().getFiltersAPI().getStorage().get().forEach((request: FilterRequest) => {
            map[request.asDesc().request] = request;
        });
        const data: IPCMessages.ISearchResultMapData = message.getData();
        let index: number = 0;
        Object.keys(this._indexes).forEach((key: string) => {
            if (index < this._indexes[key]) {
                index = this._indexes[key] + 1;
            }
        });
        if (this._searchExpanded) {
            // Expanded
            Object.keys(data.map).forEach((key: number | string) => {
                const matches: string[] = data.map[key];
                matches.forEach((match: string) => {
                    if (this._indexes[match] === undefined) {
                        this._indexes[match] = index;
                        this._columns[match] = {
                            description: match,
                            index: index,
                            search: true,
                            guid: Toolkit.guid(),
                        };
                        index += 1;
                    }
                    const point: IMapPoint = {
                        position: typeof key === 'number' ? key : parseInt(key, 10),
                        color: map[match] === undefined ? '' : (map[match].getBackground() !== '' ? map[match].getBackground() : map[match].getColor()),
                        column: this._indexes[match],
                        description: match,
                        reg: match,
                        regs: [match],
                    };
                    this._state.points.push(point);
                });
            });
        } else {
            // Single
            Object.keys(data.map).forEach((key: number | string) => {
                const matches: string[] = data.map[key];
                const match: string = matches[0];
                const point: IMapPoint = {
                    position: typeof key === 'number' ? key : parseInt(key, 10),
                    color: map[match] === undefined ? '' : (map[match].getBackground() !== '' ? map[match].getBackground() : map[match].getColor()),
                    column: index,
                    description: matches.join(', '),
                    reg: match,
                    regs: matches,
                };
                this._state.points.push(point);
            });
            this._columns[CMatchesKey] = {
                description: 'Matches',
                index: index,
                search: true,
                guid: Toolkit.guid(),
            };
            index += 1;
        }
        // Trigger event
        this._saveTriggerStateUpdate();
    }

    private _ipc_onStreamUpdated(message: IPCMessages.StreamUpdated) {
        if (message.guid !== this._guid) {
            return;
        }
        this._state.count = message.rows;
        this._saveTriggerStateUpdate();
    }
}
