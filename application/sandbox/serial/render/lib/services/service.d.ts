import * as Toolkit from 'chipmunk.client.toolkit';
import { IPopup, ENotificationType } from 'chipmunk.client.toolkit';
import { IOptions } from '../common/interface.options';
import { Observable } from 'rxjs';
import { IPortState, IPortSession } from '../common/interface.portinfo';
export declare class Service extends Toolkit.APluginService {
    state: {
        [port: string]: IPortState;
    };
    savedSession: {
        [session: string]: IPortSession;
    };
    sessionConnected: {
        [session: string]: {
            [port: string]: IPortState;
        };
    };
    private api;
    private session;
    private sessions;
    private _subscriptions;
    private _logger;
    private _openQueue;
    private _messageQueue;
    private _popupGuid;
    private _subjects;
    constructor();
    private _onAPIReady;
    private _onSessionOpen;
    private _onSessionClose;
    private _onSessionChange;
    getObservable(): {
        event: Observable<any>;
    };
    incomeMessage(): void;
    private _saveLoad;
    private emptyQueue;
    connect(options: IOptions): Promise<void>;
    disconnect(port: string): Promise<any>;
    requestPorts(): Promise<any>;
    startSpy(options: IOptions[]): Promise<any>;
    stopSpy(options: IOptions[]): Promise<any>;
    sendMessage(message: string, port: string): Promise<any>;
    writeConfig(options: IOptions): Promise<void>;
    readConfig(): Promise<any>;
    removeConfig(port: string): Promise<void>;
    popupButton(action: (boolean: any) => void): void;
    removePopup(): void;
    addPopup(popup: IPopup): void;
    notify(caption: string, message: string, type: ENotificationType): void;
}
declare const _default: Service;
export default _default;
