import { Observable, Subject } from 'rxjs';
import { ControllerSessionTabStreamSearch, ISearchPacket } from './controller.session.tab.search.output';
import * as Toolkit from 'logviewer.client.toolkit';

export interface IControllerSessionStream {
    guid: string;
}

export class ControllerSessionTabSearch {

    private _logger: Toolkit.Logger;
    private _guid: string;
    private _subjects = {
        add: new Subject<ISearchPacket>(),
        clear: new Subject<void>(),
    };
    private _output: ControllerSessionTabStreamSearch = new ControllerSessionTabStreamSearch();

    constructor(params: IControllerSessionStream) {
        this._guid = params.guid;
        this._logger = new Toolkit.Logger(`ControllerSessionTabStreamSearch: ${params.guid}`);
    }

    public destroy() {

    }

    public getGuid(): string {
        return this._guid;
    }

    public getOutputStream(): ControllerSessionTabStreamSearch {
        return this._output;
    }

    public getObservable(): {
        add: Observable<ISearchPacket>,
        clear: Observable<void>
    } {
        return {
            add: this._subjects.add.asObservable(),
            clear: this._subjects.clear.asObservable()
        };
    }

}
