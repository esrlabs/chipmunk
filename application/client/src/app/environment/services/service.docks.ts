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
        dragOver: new Subject<string>(),
        dragDrop: new Subject<DockDef.IDockDrop>(),
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
        resized: Observable<DockDef.IPositionSubject>,
        moved: Observable<DockDef.IPositionSubject>,
        resizeStarted: Observable<string>,
        resizeFinished: Observable<string>,
        dragStarted: Observable<string>,
        dragFinished: Observable<string>,
        dragOver: Observable<string>,
        dragDrop: Observable<DockDef.IDockDrop>,
    } {
        return {
            dock: this._subjects.dock.asObservable(),
            resized: this._subjects.resized.asObservable(),
            moved: this._subjects.moved.asObservable(),
            resizeStarted: this._subjects.resizeStarted.asObservable(),
            resizeFinished: this._subjects.resizeFinished.asObservable(),
            dragStarted: this._subjects.dragStarted.asObservable(),
            dragFinished: this._subjects.dragFinished.asObservable(),
            dragOver: this._subjects.dragOver.asObservable(),
            dragDrop: this._subjects.dragDrop.asObservable(),
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

    public dragOver(id: string) {
        this._subjects.dragOver.next(id);
    }

    public dragDrop(data: DockDef.IDockDrop) {
        this._subjects.dragDrop.next(data);
        const host: DockDef.IDock = Object.assign({}, this._getById(data.host));
        const target: DockDef.IDock = Object.assign({}, this._getById(data.target));
        const hostPos = host.position;
        ['child', 'id', 'position'].forEach((field: string) => {
            delete target[field];
            delete host[field];
        });
        target.position = hostPos;
        switch (data.parking) {
            case 'top':
            case 'left':
                if (data.parking === 'top') {
                    target.position.position = DockDef.EDockPosition.vertical;
                } else {
                    target.position.position = DockDef.EDockPosition.horizontal;
                }
                this._update(data.host, target);
                this._update(data.target, host);
                break;
            case 'bottom':
            case 'right':
                break;
        }
        console.log(data, host, target);
    }

    private _getById(id: string, dock?: DockDef.IDock): DockDef.IDock | null {
        if (dock === undefined || typeof id !== 'string') {
            dock = this._dock;
        }
        if (dock.id === id) {
            return dock;
        } else if (dock.child !== undefined) {
            return this._getById(id, dock.child);
        }
        return null;
    }

    private _update(id: string, update: any): void {
        const dock: DockDef.IDock = this._getById(id);
        if (dock === null) {
            return;
        }
        Object.keys(dock).forEach((key: string) => {
            if (update[key] !== void 0) {
                dock[key] = update[key];
            }
        });
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
