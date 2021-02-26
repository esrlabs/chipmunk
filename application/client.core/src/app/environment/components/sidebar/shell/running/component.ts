import { NotificationsService } from '../../../../services.injectable/injectable.service.notifications';
import { IShellProcess} from '../../../../../../../../common/ipc/electron.ipc.messages';
import { Component, OnDestroy, ChangeDetectorRef, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import ElectronIpcService, { IPCMessages } from '../../../../services/service.electron.ipc';
import ContextMenuService, { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import ShellService from '../services/service';
import EventsSessionService from '../../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-sidebar-app-shell-running',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppShellRunningComponent implements OnDestroy, OnInit {

    public _ng_running: IShellProcess[] = [];

    private _destroyed: boolean = false;
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellRunningComponent');

    constructor(private _cdRef: ChangeDetectorRef,
                private _notificationsService: NotificationsService) {
        this._subscriptions.ShellProcessListEvent = ElectronIpcService.subscribe(IPCMessages.ShellProcessListEvent, this._onListUpdate.bind(this));
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
    }

    public ngOnInit() {
        this._restoreSession();
    }

    public ngOnDestroy() {
        this._destroyed = true;
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
                    const session: string = ShellService.session.getGuid();
                    ElectronIpcService.request(new IPCMessages.ShellProcessKillRequest({ session: session, guid: process.guid }), IPCMessages.ShellProcessKillResponse).then((response: IPCMessages.ShellProcessKillResponse) => {
                        if (response.error !== undefined) {
                            this._logger.error(`Fail to terminate process "${process.command}" due error: ${response.error}`);
                            this._notificationsService.add({
                                caption: 'Fail terminate process',
                                message: `Fail to terminate process "${process.command}" due error: ${response.error}`
                            });
                        } else {
                            ShellService.removeProcess(session, process.guid);
                        }
                    }).catch((error: Error) => {
                        this._logger.error(`Fail to terminate process "${process.command}" due error: ${error.message}`);
                        this._notificationsService.add({
                            caption: 'Fail terminate process',
                            message: `Fail to terminate process "${process.command}" due error: ${error.message}`
                        });
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
        this._ng_running = [...ShellService.processes];
    }

    private _onListUpdate(response: IPCMessages.ShellProcessListEvent) {
        if (ShellService.session.getGuid() === response.session) {
            this._ng_running = [...response.processes];
            this._forceUpdate();
        }
    }

    private _onSessionChange() {
        this._restoreSession();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
