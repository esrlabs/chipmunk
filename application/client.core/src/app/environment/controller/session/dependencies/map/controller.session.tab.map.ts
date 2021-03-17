import { Subject, Observable, Subscription } from 'rxjs';
import { IPCMessages as IPC, Subscription as IPCSubscription } from '../../../../services/service.electron.ipc';
import { ControllerSessionTabSearch } from '../search/controller.session.tab.search';
import { FilterRequest, IFilterUpdateEvent } from '../search/dependencies/filters/controller.session.tab.search.filters.storage';
import { ControllerSessionTabStream } from '../stream/controller.session.tab.stream';
import { IPositionData } from '../output/controller.session.tab.stream.output';
import { Lock } from '../../../helpers/lock';
import { Dependency, SessionGetter } from '../session.dependency';

import ServiceElectronIpc from '../../../../services/service.electron.ipc';

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

export interface IMap {
    points: IMapPoint[];
    columns: number;
}

const CSettings = {
    columnWideWidth: 16,
    columnNarroweWidth: 8,
    minMarkerHeight: 1,
};

export class ControllerSessionTabMap implements Dependency {

    private _guid: string;
    private _logger: Toolkit.Logger;
    private _state: IMapState = {
        count: 0,
        position: 0,
        rowsInView: 0,
    };
    private _subscriptions: { [key: string]: IPCSubscription | Subscription } = {};
    private _expanded: boolean = false;
    private _width: number = CSettings.columnNarroweWidth;
    private _cached: {
        src: IPC.ISearchResultMapData | undefined,
        map: IMap;
        hash: {
            SearchResultMapUpdated: string;
            SearchResultMapRequest: string;
        },
    } = {
        src: undefined,
        map: { points: [], columns: 0 },
        hash: {
            SearchResultMapUpdated: Toolkit.guid(), // Hash created on event SearchResultMapUpdated
            SearchResultMapRequest: Toolkit.guid() // Hash created on request map with SearchResultMapRequest    
        },
    };
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
            this._subscriptions.SearchResultMapUpdated = ServiceElectronIpc.subscribe(IPC.SearchResultMapUpdated, this._ipc_SearchResultMapUpdated.bind(this));
            this._subscriptions.StreamUpdated = ServiceElectronIpc.subscribe(IPC.StreamUpdated, this._ipc_onStreamUpdated.bind(this));
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

    public toggleColumnWidth() {
        this._width = this.isColumnsWide() ? CSettings.columnNarroweWidth : CSettings.columnWideWidth;
    }

    public repainted() {
        this._subjects.onRepainted.next();
    }

    public isExpanded(): boolean {
        return this._expanded;
    }

    public expanding() {
        this._expanded = !this._expanded;
        this._cached.map = this._extractMap(this._expanded, this._cached.src.map);
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
        const points: IMapPoint[] = this._cached.map.points;
        if (points.length === 0) {
            return;
        }
        if (isNaN(row) || !isFinite(row)) {
            this._logger.warn(`Value of target row is incorrect.`);
        }
        const target: { index: number, position: number } = { index: 0, position: points[0].position };
        let distance: number = Math.abs(row - target.position);
        points.forEach((point: IMapPoint, i: number) => {
            const _distance: number = Math.abs(row - point.position);
            if (_distance < distance) {
                distance = _distance;
                target.position = point.position;
                target.index = i;
            }
        });
        return target;
    }

    public getMap(scale: number, expanded?: boolean, force: boolean = false): Promise<IMap> {
        expanded = expanded === undefined ? this._expanded : expanded;
        return new Promise<IMap>((resolve, reject) => {
            if (this._cached.hash.SearchResultMapRequest === this._cached.hash.SearchResultMapUpdated && !force) {
                return resolve({
                    points: this._cached.map.points,
                    columns: this._cached.map.columns,
                });
            }
            ServiceElectronIpc.request(new IPC.SearchResultMapRequest({
                streamId: this._guid,
                scale: scale,
                details: expanded,
            }), IPC.SearchResultMapResponse).then((response: IPC.SearchResultMapResponse) => {
                this._cached.hash.SearchResultMapUpdated = this._cached.hash.SearchResultMapRequest;
                this._cached.src = response.getData();
                this._cached.map = this._extractMap(expanded, this._cached.src.map);
                resolve({
                    points: this._cached.map.points,
                    columns: this._cached.map.columns,
                });
            }).catch((err: Error) => {
                reject(new Error(this._logger.warn(`Fail delivery search result map due error: ${err.message}`)));
            });
        });
    }

    public getMatchesMap(scale: number, range: { begin: number, end: number }): Promise<{
        [key: number]: {
            [key: string]: number;
        };
    }> {
        return new Promise((resolve, reject) => {
            ServiceElectronIpc.request(new IPC.SearchResultMapRequest({
                streamId: this._guid,
                scale: scale,
                range: range,
                details: true
            }), IPC.SearchResultMapResponse).then((response: IPC.SearchResultMapResponse) => {
                resolve(response.getData().map);
            }).catch((err: Error) => {
                reject(new Error(this._logger.warn(`Fail delivery search result map due error: ${err.message}`)));
            });
        });
    }

    private _extractMap(expanded: boolean, scaled: { [key: number]: { [key: string ]: number } }): IMap {
        function max(matches: { [match: string]: number }): string {
            let v: number = 0;
            let n: string = '';
            Object.keys(matches).forEach((key: string) => {
                if (v < matches[key]) {
                    v = matches[key];
                    n = key;
                }
            });
            return n;
        }
        const results: IMap = {
            points: [],
            columns: 0,
        };
        const map: { [key: string]: FilterRequest } = {};
        this._session().getSessionSearch().getFiltersAPI().getStorage().get().forEach((request: FilterRequest) => {
            map[request.asDesc().request] = request;
        });
        let column: number = 0;
        if (expanded) {
            // Expanded
            const columns: { [key: string]: number } = {};
            Object.keys(scaled).forEach((position: number | string) => {
                const matches: { [match: string]: number } = scaled[position];
                Object.keys(matches).forEach((match: string) => {
                    if (columns[match] === undefined) {
                        columns[match] = column;
                        column += 1;
                    }
                    const point: IMapPoint = {
                        position: typeof position === 'number' ? position : parseInt(position, 10),
                        color: map[match] === undefined ? '' : (map[match].getBackground() !== '' ? map[match].getBackground() : map[match].getColor()),
                        column: columns[match],
                        description: match,
                        reg: match,
                        regs: [match],
                    };
                    results.points.push(point);
                });
            });
            results.columns = column;
        } else {
            // Single
            Object.keys(scaled).forEach((position: number | string) => {
                const matches: { [match: string]: number } = scaled[position];
                const hotest: string = max(matches);
                if (hotest !== '') {
                    const all: string[] = Object.keys(matches);
                    const point: IMapPoint = {
                        position: typeof position === 'number' ? position : parseInt(position, 10),
                        color: map[hotest] === undefined ? '' : (map[hotest].getBackground() !== '' ? map[hotest].getBackground() : map[hotest].getColor()),
                        column: 0,
                        description: all.join(', '),
                        reg: hotest,
                        regs: all,
                    };
                    results.points.push(point);
                }
            });
            results.columns = 1;
        }
        return results;
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

    private _saveTriggerStateUpdate() {
        this._subjects.onStateUpdate.next({
            count: this._state.count,
            position: this._state.position,
            rowsInView: this._state.rowsInView,
        });
    }

    private _ipc_SearchResultMapUpdated(message: IPC.SearchResultMapUpdated) {
        this._cached.hash.SearchResultMapUpdated = Toolkit.guid();
        this._saveTriggerStateUpdate();
    }

    private _ipc_onStreamUpdated(message: IPC.StreamUpdated) {
        if (message.guid !== this._guid) {
            return;
        }
        this._state.count = message.rowsCount;
        this._saveTriggerStateUpdate();
    }
}
