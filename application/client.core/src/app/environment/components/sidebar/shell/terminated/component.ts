import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { ShellService } from '../services/service';
import { Session } from '../../../../controller/session/session';

import ElectronIpcService, { IPCMessages } from '../../../../services/service.electron.ipc';
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

    @Input() public service: ShellService;

    public _ng_terminated: IPCMessages.IShellProcess[] = [];

    private _sessionID: string;
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellTerminatedComponent');

    constructor() {
        this._sessionID = TabsSessionsService.getActive().getGuid();
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(
            this._onSessionChange.bind(this),
        );
        this._subscriptions.ShellProcessListEvent = ElectronIpcService.subscribe(
            IPCMessages.ShellProcessStoppedEvent,
            this._onListUpdate.bind(this),
        );
    }

    public ngOnInit() {
        this._restoreSession();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_info(process: IPCMessages.IShellProcess): ITerminatedProcessInfo {
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

    private _restoreSession() {
        this.service
            .getTerminated(this._sessionID)
            .then((response: IPCMessages.ShellProcessTerminatedListResponse) => {
                if (response.session === this._sessionID) {
                    this._ng_terminated = this._colored(response.processes);
                }
            })
            .catch((error: string) => {
                this._logger.error(error);
            });
    }

    private _onListUpdate(response: IPCMessages.ShellProcessStoppedEvent) {
        if (this._sessionID === response.session) {
            this._ng_terminated = this._colored(response.processes);
        }
    }

    private _colored(processes: IPCMessages.IShellProcess[]): IPCMessages.IShellProcess[] {
        processes.forEach((process: IPCMessages.IShellProcess) => {
            process.meta.color = SourcesService.getSourceColor(process.meta.sourceId);
        });
        return processes;
    }

    private _onSessionChange(session: Session | undefined) {
        if (session !== undefined) {
            this._sessionID = session.getGuid();
            this._restoreSession();
        }
    }
}
