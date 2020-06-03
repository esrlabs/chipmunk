import * as Toolkit from 'chipmunk.client.toolkit';

import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { Observable, Subscription, Subject } from 'rxjs';
import { IPCMessages } from '../../../services/service.electron.ipc';
import { Terminal, IDisposable } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import EventsSessionService from '../../../services/standalone/service.events.session';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import ElectronIpcService from '../../../services/service.electron.ipc';
import ViewsEventsService from '../../../services/standalone/service.views.events';

interface ITermSession {
    controller: ControllerSessionTab;
    xterm: Terminal;
    streaming: boolean;
}

const CSettings = {
    cacheLimit: 1000000, // chars
};

export class ServiceData {
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private _active: string | undefined;
    private _logger: Toolkit.Logger = new Toolkit.Logger(`PTY ServiceData`);
    private _sessions: Map<string, ITermSession> = new Map();

    private _subjects: {
        onData: Subject<string>;
        onSessionChange: Subject<void>;
        onResize: Subject<void>;
    } = {
        onData: new Subject<string>(),
        onSessionChange: new Subject<void>(),
        onResize: new Subject<void>(),
    };

    constructor() {
        this._init();
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(
            this._onSessionChange.bind(this),
        );
        this._subscriptions.onSessionClosed = EventsSessionService.getObservable().onSessionClosed.subscribe(
            this._onSessionClosed.bind(this),
        );
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(
            this._onResize.bind(this),
        );
        this._subscriptions.StreamPtyOutRequest = ElectronIpcService.subscribe(IPCMessages.StreamPtyOutRequest, this._ipc_StreamPtyOutRequest.bind(this));
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._sessions.forEach((session: ITermSession) => {
            session.xterm.dispose();
        });
        this._sessions.clear();
    }

    public getObservable(): {
        onData: Observable<string>;
        onSessionChange: Observable<void>;
        onResize: Observable<void>;
    } {
        return {
            onData: this._subjects.onData.asObservable(),
            onSessionChange: this._subjects.onSessionChange.asObservable(),
            onResize: this._subjects.onResize.asObservable(),
        };
    }

    public send(data: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._active === undefined) {
                return reject(new Error(`No active session`));
            }
            ElectronIpcService.request(new IPCMessages.StreamPtyInRequest({
                guid: this._active,
                data: data
            }), IPCMessages.StreamPtyInResponse).then((response: IPCMessages.StreamPtyInResponse) => {
                if (response.error !== undefined) {
                    return reject(new Error(response.error));
                }
                resolve();
            }).catch((err: Error) => {
                reject(err);
            });
        });
    }

    public getSessionGuid(): string | undefined {
        return this._active;
    }

    public toggleRedirection(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const guid: string | undefined = this._active;
            ElectronIpcService.request(new IPCMessages.StreamPtyStreamingRequest({
                guid: guid,
                streaming: !this.getRedirectionState()
            }), IPCMessages.StreamPtyStreamingResponse).then((response: IPCMessages.StreamPtyStreamingResponse) => {
                if (response.error !== undefined) {
                    return reject(new Error(response.error));
                }
                const session: ITermSession | undefined = this._sessions.get(guid);
                if (session === undefined) {
                    return reject(new Error(`Session isn't available anymore`));
                }
                session.streaming = !session.streaming;
                this._sessions.set(guid, session);
                resolve(session.streaming);
            }).catch((err: Error) => {
                reject(err);
            });
        });
    }

    public getRedirectionState(): boolean {
        const session: ITermSession | undefined = this._sessions.get(this._active);
        if (session === undefined) {
            return false;
        }
        return session.streaming;
    }

    private _init(controller?: ControllerSessionTab) {
        controller = controller === undefined ? TabsSessionsService.getActive() : controller;
        if (controller === undefined) {
            return;
        }
        // Store controller
        this._session = controller;
        if (!this._redirections.has(this._session.getGuid())) {
            this._redirections.set(this._session.getGuid(), true);
        }
        // Trigger event
        this._subjects.onSessionChange.next();
    }

    private _addToCache(data: string) {
        if (this._session === undefined) {
            return;
        }
        let cached: string = this._cache.has(this._session.getGuid()) ? this._cache.get(this._session.getGuid()) : '';
        cached = cached + data;
        if (cached.length > CSettings.cacheLimit) {
            cached = cached.substr(cached.length - CSettings.cacheLimit, CSettings.cacheLimit);
        }
        this._cache.set(this._session.getGuid(), cached);
    }

    private _onSessionChange(controller: ControllerSessionTab) {
        if (controller === undefined) {
            return;
        }
        this._init(controller);
    }

    private _onResize() {
        if (this._session === undefined) {
            return;
        }
        this._subjects.onResize.next();
    }

    private _onSessionClosed(session: string) {
        this._cache.delete(session);
    }

    private _ipc_StreamPtyOutRequest(message: IPCMessages.StreamPtyOutRequest, response: (message: IPCMessages.TMessage) => void) {
        this._addToCache(message.data);
        if (this._session !== undefined && this._session.getGuid() === message.guid) {
            this._subjects.onData.next(message.data);
        }
        response(new IPCMessages.StreamPtyOutResponse({}));
    }

}

export default new ServiceData();
