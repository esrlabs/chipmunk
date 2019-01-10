import { Observable, Subject } from 'rxjs';
import { DocksPositionsHolder } from './service.docks.positions';
import * as Tools from '../tools/index';
import * as DockDef from './service.docks.definitions';

export class DocksService {

    private _subjectDocks = new Subject<DockDef.IDock>();
    private _subjectCoors = new Subject<Map<string, DockDef.IDock>>();
    private _subjectResized = new Subject<DockDef.ISubjectResized>();
    private _subjectMoved = new Subject<DockDef.ISubjectMoved>();
    private _subjectStartedManipulation = new Subject<string>();
    private _subjectFinishedManipulation = new Subject<string>();
    private _docks: Map<string, DockDef.IDock> = new Map();
    private _sessionId: string = '';
    private _holder: DocksPositionsHolder = new DocksPositionsHolder();

    constructor(sessionId: string, docks: DockDef.IDock[]) {
        this._sessionId = sessionId;
        // this._holder.subscribe(DocksPositionsHolder.EVENTS.reordered, this._onReordered.bind(this));
        this._holder.subscribe(DocksPositionsHolder.EVENTS.resized, this._onResized.bind(this));
        this._holder.subscribe(DocksPositionsHolder.EVENTS.moved, this._onMoved.bind(this));
        if (docks instanceof Array) {
            docks.forEach((dock: DockDef.IDock) => {
                dock = this._normalize(dock);
                if (dock === null) {
                    return;
                }
                this._docks.set(dock.id, dock);
                this._holder.add(dock.id, dock.position);
            });
        }
    }

    public destroy() {
        this._holder.unsubscribeAll();
    }

    public get(): Map<string, DockDef.IDock> {
        return this._docks;
    }

    public add(dock: DockDef.IDock) {
        dock = this._normalize(dock);
        if (dock === null) {
            return;
        }
        this._docks.set(dock.id, dock);
        // this._coors.add(dock.id, dock.coor);
        this._subjectDocks.next(dock);
    }

    public clear() {
        this._docks.clear();
        this._subjectDocks.next();
    }

    public getDocksObservable(): Observable<DockDef.IDock> {
        return this._subjectDocks.asObservable();
    }

    public getCoorsObservable(): Observable<Map<string, DockDef.IDock>> {
        return this._subjectCoors.asObservable();
    }

    public getResizedObservable(): Observable<DockDef.ISubjectResized> {
        return this._subjectResized.asObservable();
    }

    public getMovedObservable(): Observable<DockDef.ISubjectMoved> {
        return this._subjectMoved.asObservable();
    }

    public getStartedManipulationObservable(): Observable<string> {
        return this._subjectStartedManipulation.asObservable();
    }

    public getFinishedManipulationObservable(): Observable<string> {
        return this._subjectFinishedManipulation.asObservable();
    }

    public getSessionId(): string {
        return this._sessionId;
    }

    private _normalize(dock: DockDef.IDock): DockDef.IDock {
        if (typeof dock !== 'object' || dock === null) {
            return null;
        }
        dock.id = typeof dock.id === 'string' ? (dock.id.trim() !== '' ? dock.id : Tools.guid()) : Tools.guid();
        return dock;
    }
/*
    private _onReordered() {
        this._docks.forEach((dock: DockDef.IDock, id: string) => {
            dock.coor = this._coors.get(id);
            this._docks.set(id, dock);
        });
        this._subjectCoors.next(this._docks);
    }
*/
    private _onResized(data: DockDef.ISubjectResized) {
        this._subjectResized.next(data);
    }

    private _onMoved(data: DockDef.ISubjectMoved) {
        this._subjectMoved.next(data);
    }

}
