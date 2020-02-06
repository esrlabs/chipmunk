// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ElementRef, ViewChild } from '@angular/core';
import { EHostEvents, EHostCommands } from '../../common/host.events';
import { IForkSettings } from '../../common/interface.settings';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IEnvVar {
    key: string;
    value: string;
}

interface IState {
    _ng_envvars: IEnvVar[];
    _ng_settings: IForkSettings | undefined;
    _ng_working: boolean;
    _ng_cmd: string;
}

const state: Toolkit.ControllerState<IState> = new Toolkit.ControllerState<IState>();

@Component({
    selector: Toolkit.EViewsTypes.sidebarVertical,
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarVerticalComponent implements AfterViewInit, OnDestroy {

    @ViewChild('cmdinput', {static: false}) _ng_input: ElementRef;

    @Input() public api: Toolkit.IAPI;
    @Input() public session: string;
    @Input() public sessions: Toolkit.ControllerSessionsEvents;

    public _ng_envvars: IEnvVar[] = [];
    public _ng_settings: IForkSettings | undefined;
    public _ng_working: boolean = false;
    public _ng_cmd: string = '';

    private _subscriptions: { [key: string]: Toolkit.Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger(`Plugin: processes: inj_output_bot:`);
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngOnDestroy() {
        this._destroyed = true;
        this._saveState();
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    ngAfterViewInit() {
        // Subscription to income events
        this._subscriptions.incomeIPCHostMessage = this.api.getIPC().subscribe((message: any) => {
            if (typeof message !== 'object' && message === null) {
                // Unexpected format of message
                return;
            }
            if (message.streamId !== this.session) {
                // No definition of streamId
                return;
            }
            this._onIncomeMessage(message);
        });
        // Subscribe to sessions events
        this._subscriptions.onSessionChange = this.sessions.subscribe().onSessionChange(this._onSessionChange.bind(this));
        this._subscriptions.onSessionOpen = this.sessions.subscribe().onSessionOpen(this._onSessionOpen.bind(this));
        this._subscriptions.onSessionClose = this.sessions.subscribe().onSessionClose(this._onSessionClose.bind(this));
        // Restore state
        this._loadState();
    }

    public _ng_onKeyUp(event: KeyboardEvent) {
        if (this._ng_working) {
            this._sendInput(event);
        } else {
            this._sendCommand(event);
        }
    }

    public _ng_onStop(event: MouseEvent) {
        this._sendStop();
    }

    private _sendCommand(event: KeyboardEvent) {
        if (event.key !== 'Enter') {
            return;
        }
        if (this._ng_cmd.trim() === '') {
            return;
        }
        this.api.getIPC().request({
            stream: this.session,
            command: EHostCommands.command,
            cmd: this._ng_cmd,
            shell: this._ng_settings.shell,
        }, this.session).catch((error: Error) => {
            console.error(error);
        });
    }

    private _sendStop() {
        if (!this._ng_working) {
            return;
        }
        this.api.getIPC().request({
            stream: this.session,
            command: EHostCommands.stop,
        }, this.session).catch((error: Error) => {
            console.error(error);
        });
    }

    private _sendInput(event: KeyboardEvent) {
        this.api.getIPC().request({
            stream: this.session,
            command: EHostCommands.write,
            input: event.key
        }, this.session).catch((error: Error) => {
            console.error(error);
        });
        this._ng_cmd = '';
    }

    private _onIncomeMessage(message: any) {
        if (typeof message.event === 'string') {
            // Process events
            return this._onIncomeEvent(message);
        }
    }

    private _onIncomeEvent(message: any) {
        switch (message.event) {
            case EHostEvents.ForkStarted:
                this._ng_working = true;
                break;
            case EHostEvents.ForkClosed:
                this._ng_working = false;
                this._ng_cmd = '';
                break;
            case EHostEvents.SettingsUpdated:
                this._ng_settings = message.settings;
                this._settingsUpdated();
                break;
        }
        this._forceUpdate();
    }

    private _settingsUpdated(settings?: IForkSettings) {
        if (settings !== undefined) {
            this._ng_settings = settings;
        }
        if (this._ng_settings === undefined) {
            return;
        }
        this._ng_envvars = [];
        Object.keys(this._ng_settings.env).forEach((key: string) => {
            this._ng_envvars.push({
                key: key,
                value: this._ng_settings.env[key]
            });
        });
        this._forceUpdate();
    }

    private _onSessionChange(guid: string) {
        this._saveState();
        this.session = guid;
        this._loadState();
    }

    private _onSessionOpen(guid: string) {
        //
    }

    private _onSessionClose(guid: string) {
        //
    }

    private _saveState() {
        if (this._ng_envvars.length === 0) {
            // Do not save, because data wasn't gotten from backend
            return;
        }
        state.save(this.session, {
            _ng_envvars: this._ng_envvars,
            _ng_settings: this._ng_settings,
            _ng_working: this._ng_working,
            _ng_cmd: this._ng_cmd === undefined ? '' : this._ng_cmd,
        });
    }

    private _loadState() {
        this._ng_envvars  = [];
        this._ng_settings = undefined;
        this._ng_working = false;
        this._ng_cmd = '';
        const stored: IState | undefined = state.load(this.session);
        if (stored === undefined) {
            this._initState();
        } else {
            Object.keys(stored).forEach((key: string) => {
                (this as any)[key] = stored[key];
            });
        }
        if (this._ng_input !== null && this._ng_input !== undefined) {
            this._ng_input.nativeElement.value = this._ng_cmd;
        }
        this._forceUpdate();
    }

    private _initState() {
        // Request current settings
        this.api.getIPC().request({
            stream: this.session,
            command: EHostCommands.getSettings,
        }, this.session).then((response) => {
            this._settingsUpdated(response.settings);
        });
        // Request current cwd
        this.api.getIPC().request({
            stream: this.session,
            command: EHostCommands.getSettings,
        }, this.session).then((response) => {
            this._forceUpdate();
        }).catch((error: Error) => {
            this._logger.env(`Cannot get current setting. It could be stream just not created yet. Error message: ${error.message}`);
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
