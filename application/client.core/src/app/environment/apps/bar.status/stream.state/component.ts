import { Subscription, Observable, Subject } from 'rxjs';
import { Session } from '../../../controller/session/session';
import { TasksHistoryComponent } from './history/component';
import { IComponentDesc, IFrameOptions } from 'chipmunk-client-material';
import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { IPC } from '../../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

import TabsSessionsService from '../../../services/service.sessions.tabs';
import EventsSessionService from '../../../services/standalone/service.events.session';
import ServiceElectronIpc from '../../../services/service.electron.ipc';

interface IStorage {
    tasks: IPC.IStreamProgressTrack[];
}

@Component({
    selector: 'app-apps-status-bar-stream-state',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class AppsStatusBarStreamStateComponent implements OnDestroy {
    public _ng_tasks: IPC.IStreamProgressTrack[] = [];
    public _ng_showHistory: boolean = false;
    public _ng_frame_options: IFrameOptions = {
        closable: true,
        caption: 'All tasks in queue',
        onClose: undefined,
        style: {
            maxHeight: '14rem',
        },
    };
    public _ng_component: IComponentDesc = {
        factory: TasksHistoryComponent,
        inputs: {
            tasks: [],
        },
    };

    private _logger: Toolkit.Logger = new Toolkit.Logger('AppsStatusBarStreamStateComponent');
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _sessionId: string | undefined;
    private _sessions: Map<string, IStorage> = new Map();
    private _updated: Subject<IPC.IStreamProgressTrack[]> = new Subject<
        IPC.IStreamProgressTrack[]
    >();

    constructor(private _cdRef: ChangeDetectorRef) {
        this._subscriptions.StreamProgressState = ServiceElectronIpc.subscribe(
            IPC.StreamProgressState,
            this._onStreamProgressState.bind(this),
        );
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.onSessionClosed =
            EventsSessionService.getObservable().onSessionClosed.subscribe(
                this._onSessionClosed.bind(this),
            );
        this._ng_onToggleHistory = this._ng_onToggleHistory.bind(this);
        this._ng_frame_options.onClose = this._ng_onToggleHistory;
        this._ng_component.inputs.updated = this._updated.asObservable();
        const controller: Session | undefined = TabsSessionsService.getActive();
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
        return this._ng_tasks.length > 0;
    }

    public _ng_getDeterminate(): number {
        if (this._sessionId === undefined) {
            return 100;
        }
        const storage: IStorage | undefined = this._sessions.get(this._sessionId);
        if (storage === undefined) {
            return 100;
        }
        let min: number = 100;
        storage.tasks.forEach((task: IPC.IStreamProgressTrack) => {
            if (min > task.progress) {
                min = task.progress;
            }
        });
        return min;
    }

    public _ng_onToggleHistory() {
        if (this._sessionId === undefined) {
            return;
        }
        const storage: IStorage | undefined = this._sessions.get(this._sessionId);
        if (storage === undefined) {
            this._ng_showHistory = false;
        } else {
            this._ng_showHistory = !this._ng_showHistory;
            this._ng_component.inputs.tasks = storage.tasks;
            this._cdRef.detectChanges();
        }
    }

    private _updateHistory() {
        if (!this._ng_showHistory || this._sessionId === undefined) {
            return;
        }
        const storage: IStorage | undefined = this._sessions.get(this._sessionId);
        if (storage === undefined || storage.tasks.length === 0) {
            this._ng_showHistory = false;
            this._cdRef.detectChanges();
            return;
        }
        this._updated.next(storage.tasks);
    }

    private _onStreamProgressState(message: IPC.StreamProgressState) {
        if (this._sessionId === undefined) {
            return;
        }
        this._add(message.streamId);
        const storage: IStorage | undefined = this._sessions.get(this._sessionId);
        if (storage === undefined) {
            return;
        }
        this._sessions.set(message.streamId, {
            tasks: message.tracks.map((track: IPC.IStreamProgressTrack) => {
                track.progress = Math.round(track.progress * 100);
                return track;
            }),
        });
        if (this._sessionId !== message.streamId) {
            return;
        }
        this._updateHistory();
        this._switch();
    }

    private _onSessionChange(controller: Session | undefined) {
        if (controller === undefined) {
            return;
        }
        this._ng_showHistory = false;
        this._sessionId = controller.getGuid();
        this._add(this._sessionId);
        this._switch();
    }

    private _onSessionClosed(sessionId: string) {
        this._remove(sessionId);
        this._ng_showHistory = false;
        if (this._sessionId === sessionId) {
            const controller: Session | undefined = TabsSessionsService.getActive();
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
        });
    }

    private _remove(sessionId: string) {
        this._sessions.delete(sessionId);
    }

    private _switch() {
        if (this._sessionId === undefined) {
            this._ng_tasks = [];
            this._cdRef.detectChanges();
            return;
        }
        const storage: IStorage | undefined = this._sessions.get(this._sessionId);
        if (storage === undefined) {
            this._ng_tasks = [];
        } else {
            this._ng_tasks = storage.tasks;
        }
        this._cdRef.detectChanges();
    }
}
