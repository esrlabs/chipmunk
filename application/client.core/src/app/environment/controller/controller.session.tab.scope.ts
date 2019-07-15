import { Observable, Subject } from 'rxjs';
import * as Toolkit from 'logviewer.client.toolkit';

export class ControllerSessionScope {

    private _sessionId: string;
    private _scope: Map<string, any> = new Map();

    constructor(sessionId: string) {
        this._sessionId = sessionId;
    }

    public set(key: string, value: any) {
        this._scope.set(key, value);
    }

    public get(key: string): any {
        return this._scope.get(key);
    }

}
