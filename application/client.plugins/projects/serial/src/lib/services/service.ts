import * as Toolkit from 'chipmunk.client.toolkit';
import { IPopup, ENotificationType } from 'chipmunk.client.toolkit';
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
    private _popupGuid: string;
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
        delete this.savedSession[guid];
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

    public incomeMessage() {
        this._subscriptions.incomeIPCHostMessage = this.api.getIPC().subscribe((message: any) => {
            if (typeof message !== 'object' && message === null) {
                return;
            }
            if (message.streamId !== this.session && message.streamId !== '*') {
                return;
            }
            if (message.event === EHostEvents.spyState) {
                this._subjects.event.next(message.load);
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
                    this.notify('Error', error.message, ENotificationType.error);
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
            this.notify('error', `Failed to save read load of ports: ${error.message}`, ENotificationType.error);
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
        return this.api.getIPC().request({
            stream: this.session,
            command: EHostCommands.open,
            options: options,
        }, this.session).then(() => {
            this.writeConfig(options);
            if (this.sessionConnected[this.session] === undefined) {
                this.sessionConnected[this.session] = {};
            }
            if (this.sessionConnected[this.session][options.path] === undefined) {
                this.sessionConnected[this.session][options.path] =  {connections: 0, ioState: { written: 0, read: 0}};
            }
            this._openQueue[options.path] = true;
            this.emptyQueue(options.path);
        }).catch((error: Error) => {
            this.notify('error', `Failed to connect to ${options.path}: ${error.message}`, ENotificationType.error);
        });
    }

    public disconnect(port: string): Promise<any> {
        return this.api.getIPC().request({
            stream: this.session,
            command: EHostCommands.close,
            path: port,
        }, this.session).then(() => {
            this._openQueue[port] = false;
            delete this.sessionConnected[this.session][port];
        }).catch((error: Error) => {
            this.notify('error', `Failed to disconnect from ${port}: ${error.message}`, ENotificationType.error);
        });
    }

    public requestPorts(): Promise<any> {
        return this.api.getIPC().request({
            stream: this.session,
            command: EHostCommands.list,
        }, this.session).catch((error: Error) => {
            this.notify('error', `Failed to request port list: ${error.message}`, ENotificationType.error);
        });
    }

    public startSpy(options: IOptions[]): Promise<any> {
        return this.api.getIPC().request({
            stream: this.session,
            command: EHostCommands.spyStart,
            options: options,
        }, this.session).catch((error: Error) => {
            this.notify('error', `Failed to start spying on ports: ${error.message}`, ENotificationType.error);
        });
    }

    public stopSpy(options: IOptions[]): Promise<any> {
        if (options.length > 0) {
            return this.api.getIPC().request({
                stream: this.session,
                command: EHostCommands.spyStop,
                options: options,
            }, this.session).catch((error: Error) => {
                this.notify('error', `Failed to stop spying on ports: ${error.message}`, ENotificationType.error);
            });
        }
        return Promise.resolve();
    }

    public sendMessage(message: string, port: string): Promise<any> {
        return this.api.getIPC().request({
            stream: this.session,
            command: EHostCommands.send,
            cmd: message,
            path: port
        }, this.session).catch((error: Error) => {
            this.notify('error', `Failed to send message to port: ${error.message}`, ENotificationType.error);
        });
    }

    public writeConfig(options: IOptions): Promise<void> {
        return this.api.getIPC().request({
            stream: this.session,
            command: EHostCommands.write,
            options: options
        }, this.session).catch((error: Error) => {
            this.notify('error', `Failed to write port configuration: ${error.message}`, ENotificationType.error);
        });
    }

    public readConfig(): Promise<any> {
        return this.api.getIPC().request({
            stream: this.session,
            command: EHostCommands.read,
        }, this.session).catch((error: Error) => {
            this.notify('error', `Failed to read port configuration: ${error.message}`, ENotificationType.error);
        });
    }

    public removeConfig(port: string): Promise<void> {
        return this.api.getIPC().request({
            stream: this.session,
            command: EHostCommands.remove,
            port: port
        }, this.session).catch((error: Error) => {
            this.notify('error', `Failed to remove port configuration: ${error.message}`, ENotificationType.error);
        });
    }

    public popupButton(action: (boolean) => void) {
        this.api.setSidebarTitleInjection({
            factory: SidebarTitleAddComponent,
            inputs: {
                _ng_addPort: action,
            }
        });
    }

    public removePopup() {
        this.api.removePopup(this._popupGuid);
    }

    public addPopup(popup: IPopup) {
        this._popupGuid = this.api.addPopup(popup);
    }

    public notify(caption: string, message: string, type: ENotificationType) {
        if (this.api) {
            this.api.addNotification({
                caption: caption,
                message: message,
                options: {
                    type: type
                }
            });
        } else {
            this._logger.error('API not found!');
        }
        if (type === ENotificationType.error) {
            this._logger.error(message);
        } else if (type === ENotificationType.warning) {
            this._logger.warn(message);
        } else {
            this._logger.info(message);
        }
    }
}

export default (new Service());
