import { Subject } from 'rxjs';
import { Dependency, SessionGetter } from '../session.dependency';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IRowNumberWidthData {
    rank: number;
    width: number;
    onChanged: Subject<void>;
    onSizeRequested: Subject<void>;
    checked: boolean;
}

export class ControllerSessionScope implements Dependency {
    public static Keys = {
        CRowNumberWidth: 'CRowNumberWidth',
        CViewState: 'CViewState',
    };

    private _sessionId: string;
    private _scope: Map<string, any> = new Map();
    private _session: SessionGetter;

    constructor(uuid: string, getter: SessionGetter) {
        this._sessionId = uuid;
        this._session = getter;
        this._defaults();
    }

    public init(): Promise<void> {
        return Promise.resolve();
    }

    public destroy(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._scope.clear();
            resolve();
        });
    }

    public getName(): string {
        return 'ControllerSessionScope';
    }

    public set<T>(key: string, value: T, overwrite: boolean = true) {
        if (!overwrite) {
            const stored: T | undefined = this.get(key);
            this._scope.set(key, Object.assign(stored !== undefined ? stored : {}, value));
        } else {
            this._scope.set(key, value);
        }
    }

    public get<T>(key: string): T | undefined {
        return this._scope.get(key);
    }

    public delete(key: string) {
        this._scope.delete(key);
    }

    public getSessionEventsHub(): Toolkit.ControllerSessionsEvents {
        return this._session().getSessionEventsHub();
    }

    private _defaults() {
        this.set<IRowNumberWidthData>(ControllerSessionScope.Keys.CRowNumberWidth, {
            width: 0,
            rank: 0,
            onChanged: new Subject(),
            onSizeRequested: new Subject(),
            checked: false,
        });
    }
}
