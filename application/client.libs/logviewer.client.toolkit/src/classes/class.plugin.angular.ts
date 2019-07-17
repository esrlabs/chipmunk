import { IAPI } from '../interfaces/api';

export class PluginAngularService {

    private _api: IAPI | undefined;

    public setAPI(api: IAPI) {
        this._api = api;
    }

    public getAPI(): IAPI | undefined {
        return this._api;
    }

}
