import { Subject } from 'rxjs';

export interface IRowNumberWidthData {
    rank: number;
    width: number;
    onChanged: Subject<void>;
    onSizeRequested: Subject<void>;
    checked: boolean;
}

export class ControllerSessionScope {

    public static Keys = {
        CRowNumberWidth: 'CRowNumberWidth',
        CViewState: 'CViewState',
    };

    private _sessionId: string;
    private _scope: Map<string, any> = new Map();

    constructor(sessionId: string) {
        this._sessionId = sessionId;
        this._defaults();
    }

    public destroy() {
        this._scope.clear();
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
