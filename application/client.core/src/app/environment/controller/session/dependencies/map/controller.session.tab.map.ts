import { Subject, Observable, Subscription } from 'rxjs';
import { IPCMessages as IPC, Subscription as IPCSubscription } from '../../../../services/service.electron.ipc';
import { ControllerSessionTabSearch } from '../search/controller.session.tab.search';
import { FilterRequest, IFilterUpdateEvent } from '../search/dependencies/filters/controller.session.tab.search.filters.storage';
import { ControllerSessionTabStream } from '../stream/controller.session.tab.stream';
import { IPositionData } from '../output/controller.session.tab.stream.output';
import { Lock } from '../../../helpers/lock';
import { Dependency, SessionGetter } from '../session.dependency';
import { CommonInterfaces } from '../../../../interfaces/interface.common';

import ServiceElectronIpc from '../../../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IMapState {
    count: number;
    position: number;
    rowsInView: number;
}

export interface IMapItem {
    filters: { [key: number]: {
        color: string,
        weight: number,
        index: number,
    } };
    dominant: number;
}

export interface IMap {
    filters: number;
    columns: number;
    max: number;
    items: IMapItem[];
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

export class ControllerSessionTabMap implements Dependency {

    public static MAP_REQUEST_DELAY: number = 50;

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
        map: IMap;
        src: CommonInterfaces.API.ISearchMap,
        pending: {
            scale: number;
            timer: any;
            requested: number;
            progress: boolean;
        };
    } = {
        map: { items: [], columns: 0, filters: 0, max: 0 },
        src: [],
        pending: {
            progress: false,
            scale: -1,
            timer: -1,
            requested: -1,
        },
    };
    private _lock: Lock = new Lock();
    private _subjects: {
        onStateUpdate: Subject<IMapState>,
        onPositionUpdate: Subject<IMapState>,
        onRepaint: Subject<void>,
        onRepainted: Subject<void>,
        onMapRecalculated: Subject<IMap>,
    } = {
        onStateUpdate: new Subject(),
        onPositionUpdate: new Subject(),
        onRepaint: new Subject(),
        onRepainted: new Subject(),
        onMapRecalculated: new Subject(),
    };
    private _session: SessionGetter;

    constructor(uuid: string, getter: SessionGetter) {
        this._guid = uuid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabMap: ${this._guid}`);
        this._session = getter;
    }

    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._subscriptions.StreamUpdated = ServiceElectronIpc.subscribe(IPC.StreamUpdated, this._ipc_onStreamUpdated.bind(this));
            this._subscriptions.onSearchDropped = this._session().getSessionSearch().getFiltersAPI().getObservable().dropped.subscribe(this._onSearchDropped.bind(this));
            this._subscriptions.onSearchStarted = this._session().getSessionSearch().getFiltersAPI().getObservable().searching.subscribe(this._onSearchStarted.bind(this));
            this._subscriptions.onSearchComplited = this._session().getSessionSearch().getFiltersAPI().getObservable().complited.subscribe(this._onSearchComplited.bind(this));
            this._subscriptions.onPositionChanged = this._session().getStreamOutput().getObservable().onPositionChanged.subscribe(this._onPositionChanged.bind(this));
            this._subscriptions.onFiltersStyleUpdate = this._session().getSessionSearch().getFiltersAPI().getStorage().getObservable().changed.subscribe(this._onFiltersStyleUpdate.bind(this));
            resolve();
        });
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            clearTimeout(this._cached.pending.timer);
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

    public getStreamLength(): number {
        return this._session().getStreamOutput().getRowsCount();
    }

    public getObservable(): {
        onStateUpdate: Observable<IMapState>,
        onPositionUpdate: Observable<IMapState>,
        onRepaint: Observable<void>,
        onRepainted: Observable<void>,
        onMapRecalculated: Observable<IMap>,
    } {
        return {
            onStateUpdate: this._subjects.onStateUpdate.asObservable(),
            onPositionUpdate: this._subjects.onPositionUpdate.asObservable(),
            onRepaint: this._subjects.onRepaint.asObservable(),
            onRepainted: this._subjects.onRepainted.asObservable(),
            onMapRecalculated: this._subjects.onMapRecalculated.asObservable(),
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
        this._cached.map = this._convert(this._cached.src);
        this._subjects.onMapRecalculated.next(this._cached.map);
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

    public getClosedMatchRow(positionInStream: number): Promise<{ index: number, position: number } | undefined> {
        return new Promise((resolve, reject) => {
            ServiceElectronIpc.request(new IPC.SearchResultNearestRequest({
                streamId: this._guid,
                positionInStream,
            }), IPC.SearchResultNearestResponse).then((response: IPC.SearchResultNearestResponse) => {
                if (typeof response.error === 'string') {
                    return reject(new Error(response.error))
                }
                if (response.positionInSearch === -1 || response.positionInStream === -1) {
                    return resolve(undefined);
                }
                resolve({
                    index: response.positionInSearch,
                    position: response.positionInStream,
                });
            });
        });
    }

    public update(scale: number, force: boolean) {
        const request = () => {
            this._cached.pending.progress = true;
            const requestedScale = this._cached.pending.scale;
            ServiceElectronIpc.request(new IPC.SearchResultMapRequest({
                streamId: this._guid,
                scale: requestedScale,
            }), IPC.SearchResultMapResponse).then((response: IPC.SearchResultMapResponse) => {
                if (requestedScale !== response.map.length) {
                    this._logger.warn(`Map has diffrent to requested scale. Requested for ${requestedScale}, has been gotten for ${response.map.length}`);
                    this._cached.pending.progress = false;
                    return;
                }
                this._cached.src = response.map;
                this._cached.map = this._convert(response.map);
                this._subjects.onMapRecalculated.next(this._cached.map);
                this._cached.pending.progress = false;
                if (this._cached.pending.scale !== -1) {
                    // While IPC message was in progress we get new request.
                    this.update(this._cached.pending.scale, false);
                }
            }).catch((err: Error) => {
                this._logger.warn(`Fail delivery search result map due error: ${err.message}`);
            });
            this._cached.pending.requested = -1;
            this._cached.pending.scale = -1;
        };
        if (this._cached.pending.requested === -1) {
            this._cached.pending.requested = Date.now();
        }
        this._cached.pending.scale = scale;
        if (this._cached.pending.progress) {
            return;
        }
        clearTimeout(this._cached.pending.timer);
        const timeout: number = Date.now() - this._cached.pending.requested;
        if (timeout > ControllerSessionTabMap.MAP_REQUEST_DELAY || force) {
            request();
        } else {
            this._cached.pending.timer = setTimeout(() => {
                request();
            }, timeout);
        }
    }

    public getMap(scale: number, range: { begin: number, end: number }): Promise<IMap> {
        return new Promise((resolve, reject) => {
            ServiceElectronIpc.request(new IPC.SearchResultMapRequest({
                streamId: this._guid,
                scale: scale,
                range: range,
            }), IPC.SearchResultMapResponse).then((response: IPC.SearchResultMapResponse) => {
                resolve(this._convert(response.map, true));
            }).catch((err: Error) => {
                reject(new Error(this._logger.warn(`Fail delivery search result map due error: ${err.message}`)));
            });
        });
    }

    private _convert(map: CommonInterfaces.API.ISearchMap, expanding?: boolean): IMap {
        const expanded = expanding !== undefined ? expanding : this._expanded;
        const stored = this._session().getSessionSearch().getFiltersAPI().getStorage().get();
        const single = this._session().getSessionSearch().getFiltersAPI().isSingle();
        let max: number = -1;
        const mapItems = map.map((matches: number[][]) => {
            let maxMatches: number = -1;
            const mapItem: IMapItem = {
                filters: {},
                dominant: -1,
            };
            matches.forEach((match: number[]) => {
                // match[0] - index of filter
                // match[1] - number of filter's matches
                if (match.length !== 2 && match.length !== 0) {
                    this._logger.warn(`Unexpected length of match array. Expecting 2, but gets ${match.length}`);
                    return;
                }
                if (match.length === 0) {
                    // Empty position - no matches at all
                    return;
                }
                const filterIndex: number = match[0];
                if (!single && stored.length <= filterIndex) {
                    this._logger.warn(`Filter with index = ${filterIndex} isn't found in storage (length = ${stored.length})`);
                    return;
                }
                if (expanded) {
                    mapItem.filters[filterIndex] = {
                        color: single ? '' : (stored[filterIndex] !== undefined ? stored[filterIndex].getBackground() : ''),
                        weight: match[1],
                        index: filterIndex,
                    };
                }
                if (maxMatches < match[1]) {
                    maxMatches = match[1];
                    mapItem.dominant = filterIndex;
                }
                if (max < match[1]) {
                    max = match[1];
                }
            });
            if (!expanded && mapItem.dominant !== -1) {
                mapItem.filters[0] = {
                    color: single ? '' : (stored[mapItem.dominant] !== undefined ? stored[mapItem.dominant].getBackground() : ''),
                    weight: maxMatches,
                    index: mapItem.dominant,
                };
                mapItem.dominant = 0;
            }
            return mapItem;
        });
        return {
            filters: (single || !expanded) ? 1 : stored.length,
            columns: (single || !expanded) ? 1 : stored.length,
            items: mapItems,
            max: max,
        };
    }

    private _onFiltersStyleUpdate(event: IFilterUpdateEvent) {
        if (!event.updated.colors) {
            return;
        }
        this._cached.map = this._convert(this._cached.src);
        this._subjects.onMapRecalculated.next(this._cached.map);
    }

    private _onSearchDropped() {
        // Lock update workflow
        this._lock.lock();
        // Trigger event
        this._updated();
    }

    private _onSearchStarted() {
        // Unlock update workflow
        this._lock.unlock();
    }

    private _onSearchComplited() {
        // Trigger event
        this._updated();
    }

    private _onPositionChanged(position: IPositionData) {
        this._state.position = position.start;
        this._state.rowsInView = position.count;
        // Trigger event
        this._subjects.onPositionUpdate.next(this._state);
    }

    private _updated() {
        this._subjects.onStateUpdate.next({
            count: this._state.count,
            position: this._state.position,
            rowsInView: this._state.rowsInView,
        });
    }

    private _ipc_onStreamUpdated(message: IPC.StreamUpdated) {
        if (message.guid !== this._guid) {
            return;
        }
        this._state.count = message.rows;
        this._updated();
    }
}
