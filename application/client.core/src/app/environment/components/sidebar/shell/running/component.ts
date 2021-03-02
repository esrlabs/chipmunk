import { Component, OnDestroy, OnInit, Input, ViewEncapsulation } from '@angular/core';
import { Subscription } from 'rxjs';
import { ShellService } from '../services/service';
import { Session } from '../../../../controller/session/session';

import ElectronIpcService, { IPCMessages } from '../../../../services/service.electron.ipc';
import ContextMenuService, { IMenuItem } from '../../../../services/standalone/service.contextmenu';
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
    @Input() public service: ShellService;

    public _ng_running: IPCMessages.IShellProcess[] = [];

    private _sessionID: string;
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellRunningComponent');
    private _updating: boolean = false;

    constructor() {
        this._sessionID = TabsSessionsService.getActive().getGuid();
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(
            this._onSessionChange.bind(this),
        );
        this._subscriptions.ShellProcessListEvent = ElectronIpcService.subscribe(
            IPCMessages.ShellProcessListEvent,
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

    public _ng_info(process: IPCMessages.IShellProcess): IRunningProcessInfo {
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

    public _ng_onContexMenu(event: MouseEvent, process: IPCMessages.IShellProcess) {
        const items: IMenuItem[] = [
            {
                caption: 'Terminate',
                handler: () => {
                    this.service.terminate(process).catch((error: string) => {
                        this._logger.error(error);
                    });
                },
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
    }

    private _update(guid: string) {
        if (!this._updating) {
            this._updating = true;
            this.service.getDetails(guid).then((details: IPCMessages.IShellProcess) => {
                const index: number = this._ng_running.findIndex(p => p.guid === guid);
                if (index === -1) {
                    return;
                }
                this._ng_running[index].stat = details.stat;
                this._updating = false;
            }).catch((err: Error) => {
                this._logger.warn(`Fail to request details of process "${guid}" due error: ${err.message}`);
            });
        }
    }

    private _restoreSession() {
        this.service
            .getRunning(this._sessionID)
            .then((response: IPCMessages.ShellProcessListResponse) => {
                if (response.session === this._sessionID) {
                    this._ng_running = this._colored(response.processes);
                }
            })
            .catch((error: string) => {
                this._logger.error(error);
            });
    }

    private _onListUpdate(response: IPCMessages.ShellProcessListEvent) {
        if (this._sessionID === response.session) {
            this._ng_running = this._colored(response.processes);
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
