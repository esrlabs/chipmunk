// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ElementRef, ViewChild } from '@angular/core';
import { EHostEvents, EHostCommands } from '../../common/host.events';
import { IForkSettings } from '../../common/interface.settings';

import * as Toolkit from 'logviewer.client.toolkit';

export interface IEnvVar {
    key: string;
    value: string;
}

@Component({
    selector: Toolkit.EViewsTypes.sidebarVertical,
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarVerticalComponent implements AfterViewInit, OnDestroy {

    @Input() public ipc: Toolkit.PluginIPC;
    @Input() public session: string;

    public _ng_envvars: IEnvVar[] = [];
    public _ng_settings: IForkSettings | undefined;

    private _subscription: any;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngOnDestroy() {
        if (this._subscription !== undefined) {
            this._subscription.destroy();
        }
    }

    ngAfterViewInit() {
        // Subscription to income events
        this._subscription = this.ipc.subscribeToHost((message: any) => {
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
        // Request current settings
        this.ipc.requestToHost({
            stream: this.session,
            command: EHostCommands.getSettings,
        }, this.session).then((response) => {
            this._settingsUpdated(response.settings);
        });
    }

    private _sendInput(event: KeyboardEvent) {
        this.ipc.requestToHost({
            stream: this.session,
            command: EHostCommands.write,
            input: event.key
        }, this.session).catch((error: Error) => {
            console.error(error);
        });
        (event.target as HTMLInputElement).value = '';
    }

    private _onIncomeMessage(message: any) {
        if (typeof message.event === 'string') {
            // Process events
            return this._onIncomeEvent(message);
        }
    }

    private _onIncomeEvent(message: any) {
        switch (message.event) {
            case EHostEvents.SettingsUpdated:
                this._ng_settings = message.settings;
                this._settingsUpdated();
                break;
        }
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
        this._cdRef.detectChanges();
    }


}
