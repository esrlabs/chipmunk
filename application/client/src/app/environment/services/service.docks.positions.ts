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

    public add(id: string, position: DockDef.IDockPosition) {

    }


}
