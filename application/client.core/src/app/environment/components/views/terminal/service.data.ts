import * as Toolkit from 'chipmunk.client.toolkit';

import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { Observable, Subscription, Subject } from 'rxjs';
import { IPCMessages } from '../../../services/service.electron.ipc';

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
    cols: number;
    rows: number;
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
        return session.cache;
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
    }

    public setSize(cols: number, rows: number) {
        const session: ITermSession | undefined = this._sessions.get(this._active);
        if (session === undefined) {
            return;
        }
        if (typeof cols !== 'number' || isNaN(cols) || !isFinite(cols)) {
            return;
        }
        if (typeof rows !== 'number' || isNaN(rows) || !isFinite(rows)) {
            return;
        }
        if (session.cols === cols && session.rows ===  rows) {
            return;
        }
        session.cols = cols;
        session.rows = rows;
        this._sessions.set(session.guid, session);
        ElectronIpcService.request(new IPCMessages.StreamPtyResizeRequest({
            guid: session.guid,
            col: cols,
            row: rows,
        }), IPCMessages.StreamPtyResizeResponse).then((response: IPCMessages.StreamPtyResizeResponse) => {
            if (response.error !== undefined) {
                return this._logger.warn(`Fail to update terminal size due error: ${response.error}`);
            }
        }).catch((err: Error) => {
            this._logger.warn(`Fail to send an update terminal size request due error: ${err.message}`);
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
                rows: 15,
                cols: 64,
            });
        }
        this._active = controller.getGuid();
        this._subjects.onSessionChange.next();
        // Request pending data
        ElectronIpcService.request(new IPCMessages.StreamPtyPendingRequest({
            guid: this._active,
        }), IPCMessages.StreamPtyPendingResponse).then((response: IPCMessages.StreamPtyPendingResponse) => {
            if (response.error !== undefined) {
                return this._logger.error(`Fail get pending data due error: ${response.error}`);
            }
            if (response.pending === '') {
                return;
            }
            const error: Error | undefined = this._write(this._active, response.pending);
            if (error !== undefined) {
                return this._logger.error(`Fail write data for pending data due error: ${error.message}`);
            }
        }).catch((err: Error) => {
            this._logger.error(`Fail request pending data due error: ${err.message}`);
        });
    }

    private _write(guid: string, data: string): Error | undefined {
        const session: ITermSession | undefined = this._sessions.get(guid);
        if (session === undefined) {
            return new Error(`Session "${guid}" isn't inited. Cannot bind data with terminal.`);
        }
        session.cache += data;
        if (session.cache.length > TERMINAL_CACHE_MAX_CHARS_SIZE) {
            session.cache = session.cache.substr(TERMINAL_CACHE_MAX_CHARS_SIZE - session.cache.length, TERMINAL_CACHE_MAX_CHARS_SIZE);
        }
        this._sessions.set(session.guid, session);
        if (session.guid === this._active) {
            this._subjects.onData.next(data);
        }
        return;
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
        const error: Error | undefined = this._write(message.guid, message.data);
        if (error !== undefined) {
            return response(new IPCMessages.StreamPtyOutResponse({ error: error.message}));
        }
        response(new IPCMessages.StreamPtyOutResponse({}));
    }

}

export default new ServiceData();
