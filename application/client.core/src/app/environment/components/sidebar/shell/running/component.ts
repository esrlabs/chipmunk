import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { ShellService } from '../services/service';
import { Session } from '../../../../controller/session/session';
import { NotificationsService } from '../../../../services.injectable/injectable.service.notifications';

import ElectronIpcService, { IPC } from '../../../../services/service.electron.ipc';
import TabsSessionsService from '../../../../services/service.sessions.tabs';
import SourcesService from '../../../../services/service.sources';
import EventsSessionService from '../../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

interface IRunningProcessInfo {
    running: string;
    received: string;
}

@Component({
    selector: 'app-sidebar-app-shell-running',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppShellRunningComponent implements OnDestroy, OnInit {
    @Input() public service!: ShellService;

    public _ng_running: IPC.IShellProcess[] = [];

    private _sessionID!: string;
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellRunningComponent');
    private _updating: boolean = false;

    constructor(private _notificationsService: NotificationsService) {
        const session = TabsSessionsService.getActive();
        if (session === undefined) {
            throw new Error(this._logger.error(`No active session has been found`));
        }
        this._sessionID = session.getGuid();
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.ShellProcessListEvent = ElectronIpcService.subscribe(
            IPC.ShellProcessListEvent,
            this._onListUpdate.bind(this),
        );
    }

    public ngOnInit() {
        const session: Session | undefined = TabsSessionsService.getActive();
        if (session !== undefined) {
            this._sessionID = session.getGuid();
        } else {
            this._logger.error('Session not available');
        }
        this._restoreSession();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_info(process: IPC.IShellProcess): IRunningProcessInfo {
        function getRecievedAmount(recieved: number): string {
            if (recieved < 1024) {
                return `${recieved} bytes`;
            } else if (recieved / 1024 < 1024) {
                return `${(recieved / 1024).toFixed(2)} kB`;
            } else if (recieved / 1024 / 1024 < 1024 * 1024) {
                return `${(recieved / 1024 / 1024).toFixed(2)} Mb`;
            } else {
                return `${(recieved / 1024 / 1024 / 1024).toFixed(2)} Gb`;
            }
        }
        // Update data in background
        this._update(process.guid);
        return {
            running: `${((Date.now() - process.stat.created) / 1000).toFixed(2)} s`,
            received: `${getRecievedAmount(process.stat.recieved)}`,
        };
    }

    public _ng_onTerminate(process: IPC.IShellProcess) {
        this.service
            .terminate({ session: this._sessionID, guid: process.guid }, process.command)
            .catch((error: Error) => {
                this._showNotification({
                    caption: 'Failed to terminate process',
                    message: this._logger.error(error.message),
                });
            });
    }

    public _ng_count(): string {
        const count = this._ng_running.length;
        return `${count} process${count > 1 ? 'es' : ''}`;
    }

    private _update(guid: string) {
        if (!this._updating) {
            this._updating = true;
            this.service
                .getDetails({ session: this._sessionID, guid: guid })
                .then((details: IPC.IShellProcess) => {
                    const index: number = this._ng_running.findIndex((p) => p.guid === guid);
                    if (index === -1) {
                        return;
                    }
                    this._ng_running[index].stat = details.stat;
                    this._updating = false;
                })
                .catch((err: Error) => {
                    this._logger.warn(
                        `Fail to request details of process "${guid}" due error: ${err.message}`,
                    );
                });
        }
    }

    private _restoreSession() {
        if (this._sessionID === undefined) {
            return;
        }
        this.service
            .getRunning(this._sessionID)
            .then((response: IPC.ShellProcessListResponse) => {
                if (response.session === this._sessionID) {
                    this._ng_running = this._colored(response.processes);
                }
            })
            .catch((error: Error) => {
                this._logger.error(error.message);
            });
    }

    private _onListUpdate(response: IPC.ShellProcessListEvent) {
        if (this._sessionID === response.session) {
            this._ng_running = this._colored(response.processes);
        }
    }

    private _colored(processes: IPC.IShellProcess[]): IPC.IShellProcess[] {
        processes.forEach((process: IPC.IShellProcess) => {
            const color = SourcesService.getSourceColor(process.meta.sourceId);
            color !== undefined && (process.meta.color = color);
        });
        return processes;
    }

    private _onSessionChange(session: Session | undefined) {
        if (session !== undefined) {
            this._sessionID = session.getGuid();
            this._restoreSession();
        }
    }

    private _showNotification(notification: Toolkit.INotification) {
        this._notificationsService.add({
            caption: notification.caption,
            message: notification.message,
        });
    }
}
