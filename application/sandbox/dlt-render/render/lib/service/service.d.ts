import * as Toolkit from 'chipmunk.client.toolkit';
import { Observable } from 'rxjs';
export declare class Service extends Toolkit.APluginService {
    private api;
    private _subscriptions;
    private _sessionSubscriptions;
    private _logger;
    private _session;
    private _subjects;
    constructor();
    getObservable(): {
        event: Observable<any>;
    };
    private _onAPIReady;
    private _onRowSelected;
    private _onSessionChange;
    private _onSessionClose;
}
declare const _default: Service;
export default _default;
