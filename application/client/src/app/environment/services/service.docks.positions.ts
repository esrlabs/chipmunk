import { Observable, Subject } from 'rxjs';
import * as Tools from '../tools/index';
import * as DockDef from './service.docks.definitions';

export class DocksPositionsHolder extends Tools.Emitter {

    public static EVENTS = {
        startedManipulation: Symbol(),
        finishedManipulation: Symbol(),
        reordered: Symbol(),
        resized: Symbol(),
        moved: Symbol()
    };

    private _docks: Map<string, DockDef.IDockPosition> = new Map();

    public add(id: string, position: DockDef.IDockPosition) {
        this._docks.set(id, position);
    }

    public get(id: string): DockDef.IDockPosition | undefined {
        return this._docks.get(id);
    }


}
