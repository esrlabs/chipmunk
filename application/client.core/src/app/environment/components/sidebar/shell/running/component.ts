import { IShellProcess} from '../../../../../../../../common/ipc/electron.ipc.messages';
import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { ShellService } from '../services/service';
import { Session } from '../../../../controller/session/session';

import ElectronIpcService, { IPCMessages } from '../../../../services/service.electron.ipc';
import ContextMenuService, { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import TabsSessionsService from '../../../../services/service.sessions.tabs';
import SourcesService from '../../../../services/service.sources';
import EventsSessionService from '../../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-sidebar-app-shell-running',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppShellRunningComponent implements OnDestroy, OnInit {

    @Input() public service: ShellService;

    public _ng_running: IShellProcess[] = [];

    private _sessionID: string;
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellRunningComponent');

    constructor() {
        this._sessionID = TabsSessionsService.getActive().getGuid();
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._subscriptions.ShellProcessListEvent = ElectronIpcService.subscribe(IPCMessages.ShellProcessListEvent, this._onListUpdate.bind(this));
    }

    public ngOnInit() {
        this._restoreSession();
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_tooltip(process: IShellProcess): string {
        return `Started at: ${new Date(process.stat.created).toLocaleTimeString()}`;
    }

    public _ng_onContexMenu(event: MouseEvent, process: IShellProcess) {
        const items: IMenuItem[] = [
            {
                caption: 'Terminate',
                handler: () => {
                    this.service.terminate(process).catch((error: string) => {
                        this._logger.error(error);
                    });
                }
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
    }

    private _restoreSession() {
        this.service.getRunning(this._sessionID).then((response: IPCMessages.ShellProcessListResponse) => {
            if (response.session === this._sessionID) {
                this._ng_running = this._colored(response.processes);
            }
        }).catch((error: string) => {
            this._logger.error(error);
        });
    }

    private _onListUpdate(response: IPCMessages.ShellProcessListEvent) {
        if (this._sessionID === response.session) {
            this._ng_running = this._colored(response.processes);
        }
    }

    private _colored(processes: IShellProcess[]): IShellProcess[] {
        processes.forEach((process: IShellProcess) => {
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
