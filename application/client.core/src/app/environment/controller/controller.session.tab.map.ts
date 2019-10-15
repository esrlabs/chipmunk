import { Subject, Observable, Subscription } from 'rxjs';
import ServiceElectronIpc, { IPCMessages, Subscription as IPCSubscription } from '../services/service.electron.ipc';
import { ControllerSessionTabSearch, IRequest } from './controller.session.tab.search';
import { ControllerSessionTabStream } from './controller.session.tab.stream';
import { IPositionData } from './controller.session.tab.stream.output';
import * as Toolkit from 'logviewer.client.toolkit';

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

export class ControllerSessionTabMap {

    private _guid: string;
    private _state: IMapState = {
        count: 0,
        position: 0,
        rowsInView: 0,
        points: [],
    };
    private _subscriptions: { [key: string]: IPCSubscription | Subscription } = {};
    private _columns: IColumn[] = [];
    private _searchExpanded: boolean = false;
    private _width: number = CSettings.columnNarroweWidth;
    private _search: ControllerSessionTabSearch;
    private _stream: ControllerSessionTabStream;
    private _subjects: {
        onStateUpdate: Subject<IMapState>,
        onPositionUpdate: Subject<IMapState>,
        onRepaint: Subject<void>,
        onRepainted: Subject<void>,
    } = {
        onStateUpdate: new Subject(),
        onPositionUpdate: new Subject(),
        onRepaint: new Subject(),
        onRepainted: new Subject(),
    };

    constructor(params: IControllerSessionTabMap) {
        this._guid = params.guid;
        this._search = params.search;
        this._search = params.search;
        this._stream = params.stream;
        this._subscriptions.SearchResultMap = ServiceElectronIpc.subscribe(IPCMessages.SearchResultMap, this._ipc_SearchResultMap.bind(this));
        this._subscriptions.StreamUpdated = ServiceElectronIpc.subscribe(IPCMessages.StreamUpdated, this._ipc_onStreamUpdated.bind(this));
        this._subscriptions.onSearchDropped = this._search.getObservable().onDropped.subscribe(this._onSearchDropped.bind(this));
        this._subscriptions.onPositionChanged = this._stream.getOutputStream().getObservable().onPositionChanged.subscribe(this._onPositionChanged.bind(this));

    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public getState(): IMapState {
        return this._state;
    }

    public getObservable(): {
        onStateUpdate: Observable<IMapState>,
        onPositionUpdate: Observable<IMapState>,
        onRepaint: Observable<void>,
        onRepainted: Observable<void>,
    } {
        return {
            onStateUpdate: this._subjects.onStateUpdate.asObservable(),
            onPositionUpdate: this._subjects.onPositionUpdate.asObservable(),
            onRepaint: this._subjects.onRepaint.asObservable(),
            onRepainted: this._subjects.onRepainted.asObservable(),
        };
    }

    public getColumnsCount(): number {
        if (this._state.points.length === 0) {
            return 0;
        }
        return this._columns.length;
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
        this._columns = this._columns.filter(c => !c.search);
        // Remap all points
        const map: { [key: string]: number } = {};
        let index: number = 0;
        if (this._searchExpanded) {
            this._state.points = this._state.points.map((point: IMapPoint) => {
                if (point.reg === undefined) {
                    return point;
                }
                if (map[point.reg] === undefined) {
                    map[point.reg] = index;
                    this._columns.unshift({
                        description: point.reg,
                        index: index,
                        search: true,
                        guid: Toolkit.guid(),
                    });
                    index += 1;
                }
                point.column = map[point.reg];
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
            this._columns.unshift({
                description: 'Matches',
                index: index,
                search: true,
                guid: Toolkit.guid(),
            });
        }
        // Update indexes of other columns
        this._columns = this._columns.map((col: IColumn) => {
            if (!col.search) {
                col.index = index;
                index += 1;
            }
            return col;
        });
        // Trigger event
        this._subjects.onStateUpdate.next(this._state);
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

    private _onSearchDropped() {
        // Drop points
        this._dropSearchColumns();
        // Remove search colums
        this._columns = this._columns.filter(c => !c.search);
        // Trigger event
        this._subjects.onStateUpdate.next(this._state);
    }

    private _onPositionChanged(position: IPositionData) {
        this._state.position = position.start;
        this._state.rowsInView = position.count;
        // Trigger event
        this._subjects.onPositionUpdate.next(this._state);
    }

    private _dropSearchColumns() {
        // Get columns to be reset
        const toBeReset: number[] = this._columns.filter(c => c.search).map(c => c.index);
        // Reset columns
        this._state.points = this._state.points.filter(p => toBeReset.indexOf(p.column) === -1);
    }

    private _ipc_SearchResultMap(message: IPCMessages.SearchResultMap) {
        if (message.streamId !== this._guid) {
            return;
        }
        if (!message.append) {
            this._dropSearchColumns();
        }
        const map: { [key: string]: IRequest } = {};
        this._search.getAppliedRequests().forEach((request: IRequest) => {
            map[request.reg.source] = request;
        });
        const data: IPCMessages.ISearchResultMapData = message.getData();
        // Remove search colums
        this._columns = this._columns.filter(c => !c.search);
        let index: number = 0;
        if (this._searchExpanded) {
            // Expanded
            const columns: {[key: string]: number } = {};
            Object.keys(data.map).forEach((key: number | string) => {
                const matches: string[] = data.map[key];
                matches.forEach((match: string) => {
                    if (columns[match] === undefined) {
                        columns[match] = index;
                        this._columns.unshift({
                            description: match,
                            index: index,
                            search: true,
                            guid: Toolkit.guid(),
                        });
                        index += 1;
                    }
                    const point: IMapPoint = {
                        position: typeof key === 'number' ? key : parseInt(key, 10),
                        color: map[match] === undefined ? '' : (map[match].background !== '' ? map[match].background : map[match].color),
                        column: columns[match],
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
                    color: map[match] === undefined ? '' : (map[match].background !== '' ? map[match].background : map[match].color),
                    column: index,
                    description: matches.join(', '),
                    reg: match,
                    regs: matches,
                };
                this._state.points.push(point);
            });
            this._columns.unshift({
                description: 'Matches',
                index: index,
                search: true,
                guid: Toolkit.guid(),
            });
            index += 1;
        }
        // Update indexes of other columns
        this._columns = this._columns.map((col: IColumn) => {
            if (!col.search) {
                col.index = index;
                index += 1;
            }
            return col;
        });
        // Trigger event
        this._subjects.onStateUpdate.next(this._state);
    }

    private _ipc_onStreamUpdated(message: IPCMessages.StreamUpdated) {
        if (message.guid !== this._guid) {
            return;
        }
        this._state.count = message.rowsCount;
        this._subjects.onStateUpdate.next(this._state);
    }
}
