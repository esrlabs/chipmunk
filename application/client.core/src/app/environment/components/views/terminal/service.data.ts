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
    guid: string;
    streaming: boolean;
    cache: string;
    prompt: string;
    title: string;
}

const TERMINAL_CACHE_MAX_CHARS_SIZE = 1000000;

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
        this._switch();
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

    public getCache(): string {
        const session: ITermSession | undefined = this._sessions.get(this._active);
        if (session === undefined) {
            return '';
        }
        const cache: string = session.cache;
        session.cache = '';
        this._sessions.set(session.guid, session);
        return cache;
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

    public setTitle(prompt: string) {
        const session: ITermSession | undefined = this._sessions.get(this._active);
        if (session === undefined) {
            return;
        }
        if (session.prompt === '') {
            session.prompt = prompt.trim();
        }
        session.title = prompt;
        this._sessions.set(session.guid, session);
        ElectronIpcService.request(new IPCMessages.StreamPtyOscRequest({
            guid: session.guid,
            streaming: session.prompt !== session.title,
            title: session.title,
        }), IPCMessages.StreamPtyOscResponse).then((response: IPCMessages.StreamPtyOscResponse) => {
            if (response.error !== undefined) {
                this._logger.warn(`Fail call OSC due error: ${response.error}`);
            }
        }).catch((err: Error) => {
            this._logger.warn(`Fail send request to change OSC due error: ${err.message}`);
        });
    }

    private _switch(controller?: ControllerSessionTab) {
        controller = controller === undefined ? TabsSessionsService.getActive() : controller;
        if (controller === undefined) {
            return;
        }
        if (!this._sessions.has(controller.getGuid())) {
            this._sessions.set(controller.getGuid(), {
                guid: controller.getGuid(),
                streaming: false,
                cache: '',
                prompt: '',
                title: '',
            });
        }
        this._active = controller.getGuid();
        this._subjects.onSessionChange.next();
    }

    private _onSessionChange(controller: ControllerSessionTab) {
        if (controller === undefined) {
            return;
        }
        this._switch(controller);
    }

    private _onResize() {
        if (this._active === undefined) {
            return;
        }
        this._subjects.onResize.next();
    }

    private _onSessionClosed(session: string) {
        this._sessions.delete(session);
    }

    private _ipc_StreamPtyOutRequest(message: IPCMessages.StreamPtyOutRequest, response: (message: IPCMessages.TMessage) => void) {
        const session: ITermSession | undefined = this._sessions.get(message.guid);
        if (session === undefined) {
            return response(new IPCMessages.StreamPtyOutResponse({ error: `Session "${message.guid}" isn't inited. Cannot bind data with terminal.`}));
        }
        if (session.guid !== this._active) {
            session.cache += message.data;
            if (session.cache.length > TERMINAL_CACHE_MAX_CHARS_SIZE) {
                session.cache = session.cache.substr(TERMINAL_CACHE_MAX_CHARS_SIZE - session.cache.length, TERMINAL_CACHE_MAX_CHARS_SIZE);
            }
            this._sessions.set(session.guid, session);
        } else {
            this._subjects.onData.next(message.data);
        }
        response(new IPCMessages.StreamPtyOutResponse({}));
    }

}

export default new ServiceData();
