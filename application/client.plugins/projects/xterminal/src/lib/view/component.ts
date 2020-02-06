// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ElementRef, ViewChild } from '@angular/core';
import { EHostEvents, EHostCommands } from '../common/host.events';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: Toolkit.EViewsTypes.sidebarHorizontal,
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarViewComponent implements AfterViewInit, OnDestroy {

    @ViewChild('xtermholder', {static: false}) _ng_xtermholder: ElementRef;

    @Input() public api: Toolkit.IAPI;
    @Input() public session: string;

    private _subscription: any;
    private _xterm: Terminal | undefined;
    private _fitAddon: FitAddon | undefined;

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngOnDestroy() {
        if (this._subscription !== undefined) {
            this._subscription.destroy();
            // Send command to host to destroy pty
            this.api.getIPC().send({
                session: this.session,
                command: EHostCommands.destroy
            }).then((response) => {
                // TODO: feedback based on response
            });
        }

    }

    ngAfterViewInit() {
        // Subscription to income events
        this._subscription = this.api.getIPC().subscribe((message: any) => {
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
        this._fitAddon = new FitAddon();
        this._xterm = new Terminal();
        this._xterm.loadAddon(this._fitAddon);
        this._xterm.open(this._ng_xtermholder.nativeElement);
        this._fitAddon.fit();
        this._setTheme(this._xterm);
        this._xterm.onData((data) => {
            this.api.getIPC().request({
                session: this.session,
                command: EHostCommands.write,
                data: data
            }, this.session).then((response) => {
                // TODO: feedback based on response
            });
        });
        // Send command to host to create instance of pty
        this.api.getIPC().request({
            session: this.session,
            command: EHostCommands.create
        }).then((response) => {
            // TODO: feedback based on response
        });
    }

    private _setTheme(xterm: Terminal) {
        // xterm.setOption('allowTransparency', true);
        xterm.setOption('fontFamily', 'monospace');
        xterm.setOption('fontSize', 13);
        xterm.setOption('fontWeight', 300);
        xterm.setOption('fontWeightBold', 400);
        // xterm.setOption('lineHeight', 15);
        xterm.setOption('theme', {
            background: '#333333',
            foreground: '#eaeaea',
            cursor: '#eaeaea',
            cursorAccent: '#FFFFFF',
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
                if (this._xterm === undefined || this._fitAddon === undefined) {
                    return;
                }
                this._xterm.write(message.data);
                this._fitAddon.fit();
                break;
        }
        this._cdRef.detectChanges();
    }


}
