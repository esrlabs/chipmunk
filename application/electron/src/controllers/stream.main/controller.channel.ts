import * as Tools from '../../tools/index';

import { CommonInterfaces } from '../../interfaces/interface.common';

export class Channel {

    private _subjects: {
        afterFiltersListUpdated: Tools.Subject<CommonInterfaces.API.IFilter[]>,
        afterChartsListUpdated: Tools.Subject<CommonInterfaces.API.IFilter[]>,
    } = {
        afterFiltersListUpdated: new Tools.Subject<CommonInterfaces.API.IFilter[]>(),
        afterChartsListUpdated: new Tools.Subject<CommonInterfaces.API.IFilter[]>(),
    };

    public getEvents(): {
        afterFiltersListUpdated: Tools.Subject<CommonInterfaces.API.IFilter[]>,
        afterChartsListUpdated: Tools.Subject<CommonInterfaces.API.IFilter[]>,
    } {
        return {
            afterFiltersListUpdated: this._subjects.afterFiltersListUpdated,
            afterChartsListUpdated: this._subjects.afterChartsListUpdated,
        };
    }

}