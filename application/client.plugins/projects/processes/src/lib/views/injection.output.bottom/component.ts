// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ElementRef, ViewChild } from '@angular/core';
import { EHostEvents, EHostCommands } from '../../common/host.events';
import * as Toolkit from 'logviewer.client.toolkit';

@Component({
    selector: Toolkit.EViewsTypes.outputBottom,
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class InjectionOutputBottomComponent implements AfterViewInit, OnDestroy {
    @ViewChild('cmdinput') _ng_input: ElementRef;

    @Input() public ipc: Toolkit.PluginIPC;
    @Input() public session: string;

    public _ng_cwd: string = '';
    public _ng_working: boolean = false;

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
        // Request current cwd
        this.ipc.requestToHost({
            stream: this.session,
            command: EHostCommands.getSettings,
        }, this.session).then((response) => {
            this._ng_cwd = response.settings.cwd;
        });
    }

    public _ng_onKeyUp(event: KeyboardEvent) {
        if (this._ng_working) {
            this._sendInput(event);
        } else {
            this._sendCommand(event);
        }
    }

    private _sendCommand(event: KeyboardEvent) {
        if (event.key !== 'Enter') {
            return;
        }
        const cmd: string = (event.target as HTMLInputElement).value;
        if (cmd.trim() === '') {
            return;
        }
        this.ipc.requestToHost({
            stream: this.session,
            command: EHostCommands.command,
            cmd: cmd
        }, this.session).catch((error: Error) => {
            console.error(error);
        });
        (event.target as HTMLInputElement).value = '';
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
            case EHostEvents.ForkStarted:
                this._ng_working = true;
                break;
            case EHostEvents.ForkClosed:
                this._ng_working = false;
                break;
            case EHostEvents.SettingsUpdated:
                this._ng_cwd = message.settings.cwd;
                break;
        }
        this._cdRef.detectChanges();
    }


}
