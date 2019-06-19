import * as Toolkit from 'logviewer.client.toolkit';

export interface IViewState {
    searchRequestId: string | undefined;
    isRequestValid: boolean;
    request: string;
    prevRequest: string;
    isRequestSaved: boolean;
}

export interface IViewStateOpt {
    searchRequestId?: string | undefined;
    isRequestValid?: boolean;
    request?: string;
    prevRequest?: string;
    isRequestSaved?: boolean;
}

const CStateKeys: string[] = [
    'searchRequestId',
    'isRequestValid',
    'request',
    'prevRequest',
    'isRequestSaved',
];

export class ControllerSessionTabSearchViewState {

    private _logger: Toolkit.Logger;
    private _session: string;
    private _state: IViewState = {
        searchRequestId: undefined,
        isRequestValid: true,
        request: '',
        prevRequest: '',
        isRequestSaved: false,
    };

    constructor(session: string) {
        this._session = session;
        this._logger = new Toolkit.Logger(`SearchViewState [${session}]`);
    }

    public set(state: IViewStateOpt) {
        Object.keys(state).forEach((key: string) => {
            if (CStateKeys.indexOf(key) === -1) {
                return;
            }
            this._state[key] = state[key];
        });
    }

    public get(): IViewState {
        return Object.assign({}, this._state);
    }
}
