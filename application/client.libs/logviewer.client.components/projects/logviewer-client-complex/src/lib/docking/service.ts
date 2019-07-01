import { Observable, Subject } from 'rxjs';
import * as DockDef from './service.definitions';

export { DockDef };

interface IDockData {
    target: DockDef.Dock;
    key: string;
    parent: DockDef.Container | null;
}

interface IContainerData {
    target: DockDef.Container;
    parent: DockDef.Container | null;
    key: string;
}

export class DocksService {

    private _subjects = {
        dock: new Subject<DockDef.Container>(),
        resized: new Subject<DockDef.IPositionSubject>(),
        moved: new Subject<DockDef.IPositionSubject>(),
        resizeStarted: new Subject<string>(),
        resizeFinished: new Subject<string>(),
        dragStarted: new Subject<string>(),
        dragFinished: new Subject<string>(),
        dragOver: new Subject<string>(),
        dragDrop: new Subject<DockDef.IDockDrop>(),
    };
    private _dock: DockDef.Container;
    private _sessionId: string = '';

    constructor(sessionId: string, dock: DockDef.Container) {
        this._sessionId = sessionId;
        this._dock = dock;
    }

    public destroy() {
    }

    public get(): DockDef.Container {
        return this._dock;
    }

    public clear() {
    }

    public getObservable(): {
        dock: Observable<DockDef.Container>,
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
        const host: IDockData = this._getDockById(data.host) as IDockData;
        const target: IDockData = this._getDockById(data.target) as IDockData;
        target.parent.drop(target.key);
        host.parent.optimize();
        let container;
        switch (data.parking) {
            case 'top':
            case 'left':
                if (host.parent.hasBoth()) {
                    container = new DockDef.Container({ a: target.target, b: host.target });
                    host.parent[host.key] = container;
                } else {
                    if (host.parent.a === undefined) {
                        host.parent.a = target.target;
                    } else {
                        host.parent.b = host.parent.a;
                        host.parent.a = target.target;
                    }
                    container = host.parent;
                }
                if (data.parking === 'top') {
                    container.toHorizontalAlign();
                } else {
                    container.toVerticalAlign();
                }
                break;
            case 'bottom':
            case 'right':
                if (host.parent.hasBoth()) {
                    container = new DockDef.Container({ a: host.target, b: target.target });
                    host.parent[host.key] = container;
                } else {
                    if (host.parent.b === undefined) {
                        host.parent.b = target.target;
                    } else {
                        host.parent.a = host.parent.b;
                        host.parent.b = target.target;
                    }
                    container = host.parent;
                }
                if (data.parking === 'bottom') {
                    container.toHorizontalAlign();
                } else {
                    container.toVerticalAlign();
                }
                break;
        }
        this._dock.optimize();
        this._subjects.dragFinished.next(target.target.id);
        if (target.parent.isEmpty()) {
            const emptyEntityParent: IContainerData = this._getContainerById(target.parent.id) as IContainerData;
            emptyEntityParent.parent.optimize();
        }

    }

    private _getDockById(id: string, entity?: DockDef.Dock | DockDef.Container, parent?: DockDef.Container, key?: string): IDockData | undefined {
        if (entity === undefined) {
            entity = this._dock;
        }
        if (entity instanceof DockDef.Dock && entity.id === id) {
            return { target: entity, parent: parent, key: key};
        }
        if (entity instanceof DockDef.Container) {
            let data: IDockData | undefined;
            ['a', 'b'].forEach((_key: string) => {
                if (data !== undefined) {
                    return;
                }
                if (entity[_key] !== void 0) {
                    data = this._getDockById(id, entity[_key], entity as DockDef.Container, _key);
                }
            });
            return data;
        }
        return undefined;
    }

    private _getContainerById(id: string, entity?: DockDef.Container, parent?: DockDef.Container, key?: string): IContainerData | undefined {
        if (entity === undefined) {
            entity = this._dock;
        }
        if (entity instanceof DockDef.Container) {
            if (entity.id === id) {
                return { parent: parent, target: entity, key: key };
            }
            let data: IContainerData | undefined;
            ['a', 'b'].forEach((_key: string) => {
                if (data !== undefined) {
                    return;
                }
                if (entity[_key] instanceof DockDef.Container) {
                    data = this._getContainerById(id, entity[_key], entity as DockDef.Container, _key);
                }
            });
            return data;
        }
        return undefined;
    }

}
