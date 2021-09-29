import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NotificationsService } from '../../../../services.injectable/injectable.service.notifications';
import { SidebarAppShellEnvironmentVariablesComponent } from './environment_variables/component';
import { ShellService } from '../services/service';
import { Subscription } from 'rxjs';
import { Session } from '../../../../controller/session/session';
import { MatSelectChange } from '@angular/material/select';

import PopupsService from '../../../../services/standalone/service.popups';
import TabsSessionsService from '../../../../services/service.sessions.tabs';
import EventsSessionService from '../../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

interface IEditing {
    variable: boolean;
    value: boolean;
}

export interface IEnvironment {
    variable: string;
    value: string;
    custom: boolean;
    editing: IEditing;
    selected: boolean;
}

export interface INewInformation {
    shell: string;
    pwd: string;
    env: IEnvironment[];
}

@Component({
    selector: 'app-sidebar-app-shell-environment',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppShellEnvironmentComponent implements OnDestroy, OnInit {
    @Input() public service!: ShellService;

    public _ng_expanded: boolean = false;
    public _ng_selectedShell: string = '';

    private _sessionID: string | undefined;
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellEnvironmentComponent');

    constructor(private _notificationsService: NotificationsService) {
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
    }

    public ngOnInit() {
        this._subscriptions.onShellChange = this.service
            .getObservable()
            .onShellChange.subscribe(this._onShellChange.bind(this));
        const session: Session | undefined = TabsSessionsService.getActive();
        if (session !== undefined) {
            this._sessionID = session.getGuid();
        } else {
            this._logger.error('Session not available');
        }
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onEnvironment() {
        const popupId: string | undefined = PopupsService.add({
            id: 'environment-settings-dialog',
            caption: `Environment settings`,
            component: {
                factory: SidebarAppShellEnvironmentVariablesComponent,
                inputs: {
                    information: this.service.getPreset(this.service.selectedPresetTitle)
                        .information,
                    setEnvironment: (information: INewInformation) => {
                        if (this._sessionID === undefined) {
                            return;
                        }
                        this.service
                            .setEnv({
                                session: this._sessionID,
                                env: information.env,
                            })
                            .catch((error: Error) => {
                                this._logger.error(error.message);
                            });
                        this.service
                            .setPreset(this._sessionID, { env: information.env })
                            .catch((error: Error) => {
                                this._logger.error(error.message);
                            });
                    },
                    close: () => {
                        popupId !== undefined && PopupsService.remove(popupId);
                    },
                },
            },
            buttons: [],
            options: {
                width: 60,
            },
        });
    }

    public _ng_onSetPwd() {
        if (this._sessionID === undefined) {
            return;
        }
        this.service.setPwd({ session: this._sessionID }).catch((error: Error) => {
            this._showNotification({
                caption: 'Failed to set PWD',
                message: this._logger.error(error.message),
            });
        });
    }

    public _ng_onShellChange(event: MatSelectChange) {
        if (this._sessionID === undefined) {
            return;
        }
        this.service
            .setEnv({ session: this._sessionID, shell: event.value })
            .then(() => {
                if (this._sessionID === undefined) {
                    return;
                }
                this.service
                    .setPreset(this._sessionID, { shell: event.value })
                    .catch((error: Error) => {
                        this._logger.error(error.message);
                    });
            })
            .catch((error: Error) => {
                this._showNotification({
                    caption: 'Failed to change Shell',
                    message: this._logger.error(error.message),
                });
            });
    }

    public _onShellChange(newShell: string) {
        const shell = this.service.shells.find(
            (shell: string) => shell.toLowerCase() === newShell.toLowerCase(),
        );
        shell !== undefined && (this._ng_selectedShell = shell);
    }

    private _onSessionChange(session: Session | undefined) {
        if (session !== undefined) {
            this._sessionID = session.getGuid();
        }
    }

    private _showNotification(notification: Toolkit.INotification) {
        this._notificationsService.add({
            caption: notification.caption,
            message: notification.message,
        });
    }
}
