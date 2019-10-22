import ServiceElectronIpc, { IPCMessages } from '../../../services/service.electron.ipc';
import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import { Subscription } from 'rxjs';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';

interface IStorage {
    tasks: IPCMessages.IStreamProgressTrack[];
    pipes: IPCMessages.IStreamPipeProgress[];
}

@Component({
    selector: 'app-apps-status-bar-stream-state',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class AppsStatusBarStreamStateComponent implements OnDestroy {

    public _ng_tasks: IPCMessages.IStreamProgressTrack[] = [];
    public _ng_pipes: IPCMessages.IStreamPipeProgress[] = [];

    private _logger: Toolkit.Logger = new Toolkit.Logger('AppsStatusBarStreamStateComponent');
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription | undefined } = {};
    private _sessionId: string | undefined;
    private _sessions: Map<string, IStorage> = new Map();

    constructor(private _cdRef: ChangeDetectorRef) {
        this._subscriptions.StreamPipeState = ServiceElectronIpc.subscribe(IPCMessages.StreamPipeState, this._onStreamPipeState.bind(this));
        this._subscriptions.StreamProgressState = ServiceElectronIpc.subscribe(IPCMessages.StreamProgressState, this._onStreamProgressState.bind(this));
        this._subscriptions.onSessionChange = TabsSessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._subscriptions.onSessionClosed = TabsSessionsService.getObservable().onSessionClosed.subscribe(this._onSessionClosed.bind(this));
        const controller: ControllerSessionTab | undefined = TabsSessionsService.getActive();
        if (controller === undefined) {
            return;
        }
        this._sessionId = controller.getGuid();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_isInProgress(): boolean {
        return (this._ng_tasks.length + this._ng_pipes.length) > 0;
    }

    private _onStreamPipeState(message: IPCMessages.StreamPipeState) {
        this._add(message.streamId);
        const storage: IStorage | undefined = this._sessions.get(this._sessionId);
        if (storage === undefined) {
            return;
        }
        this._sessions.set(message.streamId, {
            tasks: storage.tasks,
            pipes: message.tracks.map((pipe: IPCMessages.IStreamPipeProgress) => {
                pipe.done = parseFloat((pipe.done / 1024 / 1024).toFixed(2));
                pipe.size = parseFloat((pipe.size / 1024 / 1024).toFixed(2));
                return pipe;
            })
        });
        if (this._sessionId !== message.streamId) {
            return;
        }
        this._switch();
    }

    private _onStreamProgressState(message: IPCMessages.StreamProgressState) {
        this._add(message.streamId);
        const storage: IStorage | undefined = this._sessions.get(this._sessionId);
        if (storage === undefined) {
            return;
        }
        this._sessions.set(message.streamId, {
            pipes: storage.pipes,
            tasks: message.tracks.map((track: IPCMessages.IStreamProgressTrack) => {
                track.progress = Math.round(track.progress * 100);
                return track;
            })
        });
        if (this._sessionId !== message.streamId) {
            return;
        }
        this._switch();
    }

    private _onSessionChange(controller: ControllerSessionTab) {
        if (controller === undefined) {
            return;
        }
        this._sessionId = controller.getGuid();
        this._add(this._sessionId);
        this._switch();
    }

    private _onSessionClosed(sessionId: string) {
        this._remove(sessionId);
        if (this._sessionId === sessionId) {
            const controller: ControllerSessionTab | undefined = TabsSessionsService.getActive();
            if (controller === undefined) {
                this._sessionId = undefined;
            } else {
                this._sessionId = controller.getGuid();
            }
            this._switch();
        }
    }

    private _add(sessionId: string) {
        if (this._sessions.has(sessionId)) {
            return;
        }
        this._sessions.set(sessionId, {
            tasks: [],
            pipes: [],
        });
    }

    private _remove(sessionId: string) {
        this._sessions.delete(sessionId);
    }

    private _switch() {
        if (this._sessionId === undefined) {
            this._ng_tasks = [];
            this._ng_pipes = [];
            this._cdRef.detectChanges();
            return;
        }
        const storage: IStorage | undefined = this._sessions.get(this._sessionId);
        if (storage === undefined) {
            this._ng_tasks = [];
            this._ng_pipes = [];
        } else {
            this._ng_tasks = storage.tasks;
            this._ng_pipes = storage.pipes;
        }
        this._cdRef.detectChanges();
    }

}
