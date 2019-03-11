// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ElementRef, ViewChild } from '@angular/core';
import { EHostEvents, EHostCommands } from '../common/host.events';
import { Terminal } from 'xterm';
import * as Toolkit from 'logviewer.client.toolkit';

@Component({
    selector: Toolkit.EViewsTypes.sidebarHorizontal,
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarViewComponent implements AfterViewInit, OnDestroy {

    @ViewChild('xtermholder') _ng_xtermholder: ElementRef;

    @Input() public ipc: Toolkit.PluginIPC;
    @Input() public session: string;

    private _subscription: any;
    private _xterm: Terminal | undefined;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngOnDestroy() {
        if (this._subscription !== undefined) {
            this._subscription.destroy();
            // Send command to host to destroy pty
            this.ipc.sentToHost({
                session: this.session,
                command: EHostCommands.destroy
            }).then((response) => {
                // TODO: feedback based on response
            });
        }

    }

    ngAfterViewInit() {
        // Subscription to income events
        this._subscription = this.ipc.subscribeToHost((message: any) => {
            console.log('PLUGIN IPC: ', message);
            if (typeof message !== 'object' && message === null) {
                // Unexpected format of message
                return;
            }
            if (message.session !== this.session) {
                // No definition of streamId
                return;
            }
            this._onIncomeMessage(message);
        });
        this._createXTerm();
    }

    private _createXTerm() {
        if (this._xterm !== undefined) {
            return;
        }
        if (this._ng_xtermholder === null || this._ng_xtermholder === undefined) {
            return null;
        }
        this._xterm = new Terminal();
        this._xterm.open(this._ng_xtermholder.nativeElement);
        debugger;
        this._xterm.on('data', (data) => {
            this.ipc.requestToHost({
                session: this.session,
                command: EHostCommands.write,
                data: data
            }, this.session).then((response) => {
                // TODO: feedback based on response
            });
        });
        // Send command to host to create instance of pty
        this.ipc.requestToHost({
            session: this.session,
            command: EHostCommands.create
        }).then((response) => {
            // TODO: feedback based on response
        });
    }

    private _onIncomeMessage(message: any) {
        if (typeof message.event === 'string') {
            // Process events
            return this._onIncomeEvent(message);
        }
    }

    private _onIncomeEvent(message: any) {
        switch (message.event) {
            case EHostEvents.data:
                if (this._xterm === undefined) {
                    return;
                }
                this._xterm.write(message.data);
                break;
        }
        this._cdRef.detectChanges();
    }


}
