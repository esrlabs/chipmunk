import { Observable, Subject } from 'rxjs';
import { DocksPositionsHolder } from './service.docks.positions';
import * as Tools from '../tools/index';
import * as DockDef from './service.docks.definitions';

export { DockDef };

export class DocksService {

    private _subjects = {
        dock: new Subject<DockDef.IDock>(),
        resized: new Subject<DockDef.IPositionSubject>(),
        moved: new Subject<DockDef.IPositionSubject>(),
        resizeStarted: new Subject<string>(),
        resizeFinished: new Subject<string>(),
        dragStarted: new Subject<string>(),
        dragFinished: new Subject<string>(),
    };
    private _dock: DockDef.IDock;
    private _sessionId: string = '';
    private _holder: DocksPositionsHolder = new DocksPositionsHolder();

    constructor(sessionId: string, dock: DockDef.IDock) {
        this._sessionId = sessionId;
        this._holder.subscribe(DocksPositionsHolder.EVENTS.reordered, this._onReordered.bind(this));
        this._holder.subscribe(DocksPositionsHolder.EVENTS.resized, this._onResized.bind(this));
        this._holder.subscribe(DocksPositionsHolder.EVENTS.moved, this._onMoved.bind(this));
        this._dock = this._normalize(dock);
    }

    public destroy() {
        this._holder.unsubscribeAll();
    }

    public get(): DockDef.IDock {
        return this._dock;
    }

    public add(dock: DockDef.IDock, silence: boolean = false) {
        dock = this._normalize(dock);
        if (dock === null) {
            return;
        }
        // this._docks.set(dock.id, dock);
        this._holder.add(dock.id, dock.position);
        if (!silence) {
            this._subjects.dock.next(dock);
        }
    }

    public clear() {
    }

    public getObservable(): {
        dock: Observable<DockDef.IDock>,
        docks: Observable<Map<string, DockDef.IDock>>,
        resized: Observable<DockDef.IPositionSubject>,
        moved: Observable<DockDef.IPositionSubject>,
        resizeStarted: Observable<string>,
        resizeFinished: Observable<string>,
        dragStarted: Observable<string>,
        dragFinished: Observable<string>,
    } {
        return {
            dock: this._subjects.dock.asObservable(),
            docks: this._subjects.docks.asObservable(),
            resized: this._subjects.resized.asObservable(),
            moved: this._subjects.moved.asObservable(),
            resizeStarted: this._subjects.resizeStarted.asObservable(),
            resizeFinished: this._subjects.resizeFinished.asObservable(),
            dragStarted: this._subjects.dragStarted.asObservable(),
            dragFinished: this._subjects.dragFinished.asObservable(),
        };
    }

    public getSessionId(): string {
        return this._sessionId;
    }

    public dragStarted(id: string) {
        this._subjects.dragStarted.next(id);
    }

    public dragFinished(id: string) {
        this._subjects.dragFinished.next(id);
    }

    private _normalize(dock: DockDef.IDock): DockDef.IDock {
        if (typeof dock !== 'object' || dock === null) {
            return null;
        }
        dock.id = typeof dock.id === 'string' ? (dock.id.trim() !== '' ? dock.id : Tools.guid()) : Tools.guid();
        dock.position = this._generatePosition(dock);
        if (dock.child === undefined) {
            return dock;
        }
        dock.child = this._normalize(dock.child);
        return dock;
    }

    private _generatePosition(dock: DockDef.IDock): DockDef.IDockPosition {
        if (dock.position !== void 0) {
            return dock.position;
        }
        if (dock.child === undefined) {
            return {
                position: Math.random() > 0.5 ? DockDef.EDockPosition.horizontal : DockDef.EDockPosition.vertical,
                weight: 1
            };
        } else {
            return {
                position: Math.random() > 0.5 ? DockDef.EDockPosition.horizontal : DockDef.EDockPosition.vertical,
                weight: 0.5
            };
        }
    }

    private _onReordered() {
        /*
        this._docks.forEach((dock: DockDef.IDock, id: string) => {
            const position = this._holder.get(id);
            if (position === undefined) {
                return;
            }
            dock.position = position;
        });
        this._subjects.docks.next(this._docks);
        */
    }

    private _onResized(data: DockDef.IPositionSubject) {
        this._subjects.resized.next(data);
    }

    private _onMoved(data: DockDef.IPositionSubject) {
        this._subjects.moved.next(data);
    }

}
