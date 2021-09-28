import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { ShellService } from '../services/service';
import { Session } from '../../../../controller/session/session';
import { NotificationsService } from '../../../../services.injectable/injectable.service.notifications';

import OutputRedirectionsService, {
    EParent,
} from '../../../../services/standalone/service.output.redirections';
import ElectronIpcService, { IPC } from '../../../../services/service.electron.ipc';
import TabsSessionsService from '../../../../services/service.sessions.tabs';
import SourcesService from '../../../../services/service.sources';
import EventsSessionService from '../../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

interface ITerminatedProcessInfo {
    terminated: string;
    received: string;
}

@Component({
    selector: 'app-sidebar-app-shell-terminated',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppShellTerminatedComponent implements OnDestroy, OnInit {
    @Input() public service!: ShellService;

    public _ng_terminated: IPC.IShellProcess[] = [];

    private _sessionID!: string;
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellTerminatedComponent');

    constructor(private _notificationsService: NotificationsService) {
        const session = TabsSessionsService.getActive();
        if (session === undefined) {
            this._logger.error(`No active session`);
            return;
        }
        this._sessionID = session.getGuid();
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        this._subscriptions.ShellProcessListEvent = ElectronIpcService.subscribe(
            IPC.ShellProcessStoppedEvent,
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

    public _ng_info(process: IPC.IShellProcess): ITerminatedProcessInfo {
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
        return {
            terminated: `${(process.stat.terminated / 1000).toFixed(2)} s`,
            received: `${getRecievedAmount(process.stat.recieved)}`,
        };
    }

    public _ng_count(): string {
        const count = this._ng_terminated.length;
        return `${count} process${count > 1 ? 'es' : ''}`;
    }

    public _ng_onReplay(process: IPC.IShellProcess) {
        this.service
            .runCommand({
                session: this._sessionID,
                command: process.command,
            })
            .catch((error: Error) => {
                this._showNotification({
                    caption: 'Failed to replay command',
                    message: this._logger.error(error.message),
                });
            });
    }

    public _ng_onClickTerminated(process: IPC.IShellProcess) {
        if (process.stat.recieved === 0 || process.stat.row === undefined) {
            return;
        }
        const session: Session | Error = TabsSessionsService.getSessionController(this._sessionID);
        if (session instanceof Error) {
            this._logger.error(
                `Failed to jump to start of terminated process due to error: ${session.message}`,
            );
            return;
        }
        if (session.getStreamOutput().getRowsCount() < process.stat.row) {
            this._logger.warn(`Row of terminated process '${process.command}' is outside of file`);
            return;
        }
        OutputRedirectionsService.select(EParent.shell, this._sessionID, {
            output: process.stat.row,
        });
    }

    private _restoreSession() {
        this.service
            .getTerminated(this._sessionID)
            .then((response: IPC.ShellProcessTerminatedListResponse) => {
                if (response.session === this._sessionID) {
                    this._ng_terminated = this._colored(response.processes);
                }
            })
            .catch((error: Error) => {
                this._logger.error(error.message);
            });
    }

    private _onListUpdate(response: IPC.ShellProcessStoppedEvent) {
        if (this._sessionID === response.session) {
            this._ng_terminated = this._colored(response.processes);
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
