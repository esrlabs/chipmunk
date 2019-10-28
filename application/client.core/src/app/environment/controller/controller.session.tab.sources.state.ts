import * as Toolkit from 'chipmunk.client.toolkit';
import { Observable, Subject } from 'rxjs';

export class ControllerSessionTabSourcesState {

    private _logger: Toolkit.Logger;
    private _sessionId: string;
    private _visible: boolean = false;

    private _subjects: {
        onChanged: Subject<boolean>,
    } = {
        onChanged: new Subject<boolean>(),
    };

    constructor(session: string) {
        this._sessionId = session;
        this._logger = new Toolkit.Logger(`ControllerSessionTabSourcesState: ${session}`);
    }

    public destroy() {
    }

    public change(visible: boolean) {
        this._visible = visible;
        this._subjects.onChanged.next(this._visible);
    }

    public getObservable(): {
        onChanged: Observable<boolean>,
    } {
        return {
            onChanged: this._subjects.onChanged.asObservable(),
        };
    }

    public isVisible(): boolean {
        return this._visible;
    }

}
