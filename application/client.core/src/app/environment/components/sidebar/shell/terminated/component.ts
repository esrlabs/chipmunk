import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { Subscription } from 'rxjs';
import { ShellService } from '../services/service';
import { Session } from '../../../../controller/session/session';
import { NotificationsService } from '../../../../services.injectable/injectable.service.notifications';

import ContextMenuService, { IMenuItem } from '../../../../services/standalone/service.contextmenu';
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
    public _ng_checked: { [guid: string]: boolean } = {};
    public _ng_bundling: boolean = false;
    public _ng_bundles: IPC.IBundle[] = [];

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

    public _ng_onReplay(command: string) {
        this.service
            .runCommand({
                session: this._sessionID,
                command: command,
            })
            .catch((error: Error) => {
                this._showNotification({
                    caption: 'Failed to replay command',
                    message: this._logger.error(error.message),
                });
            });
    }

    public _ng_onReplayBundle(bundle: IPC.IBundle) {
        Promise.all(
            bundle.commands.map((command: string) => {
                return this.service
                    .runCommand({
                        session: this._sessionID,
                        command: command,
                    })
                    .catch((error: Error) => {
                        this._showNotification({
                            caption: `Failed to execute command ${command}`,
                            message: this._logger.error(error.message),
                        });
                    });
            }),
        ).catch((error: Error) => {
            this._showNotification({
                caption: `Failed to execute bundle ${bundle.title}`,
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

    public _ng_onClickCheckbox(event: MouseEvent) {
        event.stopPropagation();
    }

    public _ng_onContextMenuBundle(event: MouseEvent, bundle?: IPC.IBundle) {
        const items: IMenuItem[] = [
            {
                caption: 'Remove all',
                handler: () => {
                    this.service
                        .removeBundles(this._sessionID, this._ng_bundles)
                        .catch((error: Error) => {
                            this._logger.warn(
                                `Failed to delete bundles due to error: ${error.message}`,
                            );
                        });
                    this._ng_bundles = [];
                },
            },
        ];
        if (bundle !== undefined) {
            items.unshift({
                caption: 'Remove',
                handler: () => {
                    this.service.removeBundles(this._sessionID, [bundle]).catch((error: Error) => {
                        this._logger.warn(
                            `Failed to delete bundle ${bundle.title} due to error: ${error.message}`,
                        );
                    });
                    this._ng_bundles = this._ng_bundles.filter((ngBundle: IPC.IBundle) => {
                        return ngBundle.title !== bundle.title;
                    });
                },
            });
        }
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    public _ng_onContextMenu(event: MouseEvent, process?: IPC.IShellProcess) {
        const items: IMenuItem[] = [
            {
                caption: 'Remove all',
                handler: () => {
                    this._ng_terminated = [];
                    this._ng_checked = {};
                },
            },
        ];
        if (process !== undefined) {
            items.unshift({
                caption: 'Remove',
                handler: () => {
                    this._ng_terminated = this._ng_terminated.filter(
                        (terminated: IPC.IShellProcess) => {
                            return terminated.guid !== process.guid;
                        },
                    );
                    delete this._ng_checked[process.guid];
                },
            });
        }
        if (!this._ng_bundling && this._ng_terminated.length > 0) {
            items.unshift({
                caption: 'Create bundle',
                handler: () => {
                    this._ng_bundling = true;
                    Object.keys(this._ng_checked).forEach((guid: string) => {
                        this._ng_checked[guid] = false;
                    });
                },
            });
        } else if (this._ng_bundling) {
            items.unshift(
                {
                    caption: 'Save bundle',
                    handler: () => {
                        this._ng_bundling = false;
                        const commands: string[] = [];
                        this._ng_terminated.forEach((terminated: IPC.IShellProcess) => {
                            if (this._ng_checked[terminated.guid]) {
                                commands.push(terminated.command);
                            }
                        });
                        const bundle = {
                            title: this._generateBundleName(),
                            commands: commands,
                        };
                        this._ng_bundles.push(bundle);
                        this.service.setBundle(this._sessionID, bundle).catch((error: Error) => {
                            this._logger.warn(
                                `Failed to save bundle due to error: ${error.message}`,
                            );
                        });
                    },
                    disabled: !Object.values(this._ng_checked).includes(true),
                },
                {
                    caption: 'Cancel bundle',
                    handler: () => {
                        this._ng_bundling = false;
                    },
                },
            );
        }
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    public _ng_parseCommands(commands: string[]): string {
        return commands.join('\n');
    }

    private _restoreSession() {
        this.service
            .getHistory(this._sessionID)
            .then((response: IPC.ShellProcessHistoryGetResponse) => {
                if (response.session === this._sessionID) {
                    this._ng_terminated = this._colored(response.processes);
                    this._ng_bundles = response.bundles;
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

    private _generateBundleName(): string {
        let index: number = 0;
        const regex = /Bundle (\d+)/g;
        this._ng_bundles.forEach((bundle: IPC.IBundle) => {
            const match: RegExpMatchArray | null = bundle.title.match(regex);
            if (match !== null && match.length >= 1) {
                index = parseInt(match[0].split(' ')[1]) + 1;
            }
        });
        return `Bundle ${index}`;
    }
}
