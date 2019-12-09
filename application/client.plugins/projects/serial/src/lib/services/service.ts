import * as Toolkit from 'chipmunk.client.toolkit';
import { EHostCommands, EHostEvents } from '../common/host.events';
import { IOptions } from '../common/interface.options';
import { Observable, Subject } from 'rxjs';
import { IPortState, IPortSession } from '../common/interface.portinfo';
import { SidebarTitleAddComponent } from '../views/dialog/titlebar/components';

export class Service extends Toolkit.APluginService {

    public state:  {[port: string]: IPortState} = {};
    public savedSession: {[session: string]: IPortSession} = {};
    public sessionConnected: {[session: string]: {[port: string]: IPortState}} = {};

    private api: Toolkit.IAPI | undefined;
    private session: string;
    private sessions: string[] = [];
    private _subscriptions: { [key: string]: Toolkit.Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger(`Plugin: serial: inj_output_bot:`);
    private _openQueue: {[port: string]: boolean} = {};
    private _messageQueue: {[port: string]: string[]} = {};
    private _subjects = {
        event: new Subject<any>(),
    };

    constructor() {
        super();
        this._subscriptions.onAPIReady = this.onAPIReady.subscribe(this._onAPIReady.bind(this));
    }

    private _onAPIReady() {
        this.api = this.getAPI();
        if (this.api === undefined) {
            this._logger.error('API not found!');
            return;
        }
        this._subscriptions.onSessionOpen = this.api.getSessionsEventsHub().subscribe().onSessionOpen(this._onSessionOpen.bind(this));
        this._subscriptions.onSessionClose = this.api.getSessionsEventsHub().subscribe().onSessionClose(this._onSessionClose.bind(this));
        this._subscriptions.onSessionChange = this.api.getSessionsEventsHub().subscribe().onSessionChange(this._onSessionChange.bind(this));
    }

    private _onSessionOpen() {
        this.session = this.api.getActiveSessionId();
        if (this.sessions.includes(this.session)) {
            return;
        }
        if (this.sessions.length === 0) {
            this.incomeMessage();
        }
        this.sessions.push(this.session);
    }

    private _onSessionClose(guid: string) {
        this.sessions = this.sessions.filter(session => session !== guid);
        this.savedSession[guid] = undefined;
        if (this.sessions.length === 0) {
            this.destroy();
        }
    }

    private _onSessionChange(guid: string) {
        this.session = guid;
    }

    public getObservable(): {
        event: Observable<any>,
    } {
        return {
            event: this._subjects.event.asObservable(),
        };
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public incomeMessage() {
        this._subscriptions.incomeIPCHostMessage = this.api.getIPC().subscribeToHost((message: any) => {
            if (typeof message !== 'object' && message === null) {
                return;
            }
            if (message.streamId !== this.session && message.streamId !== '*') {
                return;
            }
            if (message.event === EHostEvents.state) {
                this._saveLoad(message.state).then((response: {[port: string]: IPortState}) => {
                    if (response === undefined) {
                        return;
                    }
                    this.state = response;
                    this._subjects.event.next(message);
                }).catch((error: Error) => {
                    this._logger.error(error);
                });
                return;
            }
            this._subjects.event.next(message);
        });
    }

    private _saveLoad(ports: { [key: string]: IPortState }): Promise<{[port: string]: IPortState} | void> {
        return new Promise<{[port: string]: IPortState}>((resolve) => {
            if (Object.keys(this.sessionConnected).length > 0) {
                Object.keys(this.sessionConnected).forEach(session => {
                    Object.keys(this.sessionConnected[session]).forEach(port => {
                        if (ports[port]) {
                            this.sessionConnected[session][port].ioState.read += ports[port].ioState.read;
                        }
                    });
                });
                resolve(this.sessionConnected[this.session]);
            } else {
                resolve();
            }
        }).catch((error: Error) => {
            this._logger.error(error);
        });
    }

    private emptyQueue(port: string) {
        if (this._messageQueue[port]) {
            this._messageQueue[port].forEach((message) => {
                this.sendMessage(message, port);
            });
        }
    }

    public connect(options: IOptions): Promise<void> {
        return this.api.getIPC().requestToHost({
            stream: this.session,
            command: EHostCommands.open,
            options: options,
        }, this.session).then(() => {
            if (this.sessionConnected[this.session] === undefined) {
                this.sessionConnected[this.session] = {};
            }
            if (this.sessionConnected[this.session][options.path] === undefined) {
                this.sessionConnected[this.session][options.path] =  {connections: 0, ioState: { written: 0, read: 0}};
            }
            this._openQueue[options.path] = true;
            this.emptyQueue(options.path);
        }).catch((error: Error) => {
            this._logger.error(error);
        });
    }

    public disconnect(port: string): Promise<any> {
        return this.api.getIPC().requestToHost({
            stream: this.session,
            command: EHostCommands.close,
            path: port,
        }, this.session).then(() => {
            this._openQueue[port] = false;
            this.sessionConnected[this.session][port] = undefined;
        }).catch((error: Error) => {
            this._logger.error(error);
        });
    }

    public requestPorts() {
        return this.api.getIPC().requestToHost({
            stream: this.session,
            command: EHostCommands.list,
        }, this.session).catch((error: Error) => {
            this._logger.error(error);
        });
    }

    public startSpy(options: IOptions[]) {
        return this.api.getIPC().requestToHost({
            stream: this.session,
            command: EHostCommands.spyStart,
            options: options,
        }, this.session).catch((error: Error) => {
            this._logger.error(error);
        });
    }

    public stopSpy(options: IOptions[]) {
        return this.api.getIPC().requestToHost({
            stream: this.session,
            command: EHostCommands.spyStop,
            options: options,
        }, this.session).catch((error: Error) => {
            this._logger.error(error);
        });
    }

    public sendMessage(message: string, port: string) {
        return this.api.getIPC().requestToHost({
            stream: this.session,
            command: EHostCommands.write,
            cmd: message,
            path: port
        }, this.session).catch((error: Error) => {
            this._logger.error(error);
        });
    }

    public popupButton(action: () => void) {
        this.api.setSidebarTitleInjection({
            factory: SidebarTitleAddComponent,
            inputs: {
                _ng_addPort: action,
            }
        });
    }

    public closePopup(popup: string) {
        this.api.removePopup(popup);
    }
}

export default (new Service());
