import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { Terminal, IDisposable } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

import * as Toolkit from 'chipmunk.client.toolkit';

import ServiceData from './service.data';
import ContextMenuService, { IMenuItem } from '../../../services/standalone/service.contextmenu';

@Component({
    selector: 'app-views-terminal',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewTerminalComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    @ViewChild('xtermholder', {static: false}) _ng_xtermholder: ElementRef;

    private _subscriptions: { [key: string]: Subscription | IDisposable } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewTerminalComponent');
    private _xterm: Terminal | undefined;
    private _fitAddon: FitAddon | undefined;
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            if (typeof (this._subscriptions[key] as any).unsubscribe === 'function') {
                (this._subscriptions[key] as any).unsubscribe();
            } else if (typeof (this._subscriptions[key] as any).dispose === 'function') {
                (this._subscriptions[key] as any).dispose();
            }
        });
        this._xterm.dispose();
    }

    public ngAfterContentInit() {

    }

    public ngAfterViewInit() {
        this._subscriptions.onOutData = ServiceData.getObservable().onData.subscribe(this._onOutData.bind(this));
        this._subscriptions.onSessionChange = ServiceData.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        this._subscriptions.onResize = ServiceData.getObservable().onResize.subscribe(this._onResize.bind(this));
        this._create();
    }

    public _ng_onContexMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: `Copy`,
                handler: () => {},
                disabled: false,
            },
            {
                caption: `Paste`,
                handler: () => {},
                disabled: false,
            },
            { /* delimiter */ },
            {
                caption: ServiceData.getRedirectionState() ? `Do not redirect output` : `Redirect output`,
                handler: () => {
                    ServiceData.toggleRedirection();
                },
                disabled: false,
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    private _create() {
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
        this._subscriptions.onTermData = this._xterm.onData(this._onInData.bind(this));
        this._subscriptions.onTitleChange = this._xterm.onTitleChange(this._onTitleChange.bind(this));
        this._onOutData(ServiceData.getCache());
        /*
        this._subscriptions.onOscEventOsc0 = this._xterm.parser.registerOscHandler(0, (params) => {
            console.warn(`Osc0 ===========> ${params}`);
            return false;
        });
        this._subscriptions.onOscEventOsc2 = this._xterm.parser.registerOscHandler(2, (params) => {
            console.warn(`Osc2 ===========> ${params}`);
            return false;
        });
        */
    }

    private _dispose() {
        if (this._fitAddon !== undefined) {
            this._fitAddon.dispose();
        }
        if (this._xterm !== undefined) {
            this._xterm.dispose();
        }
        this._fitAddon = undefined;
        this._xterm = undefined;
        (this._ng_xtermholder.nativeElement as HTMLElement).innerHTML = '';
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

    private _onInData(data: string) {
        ServiceData.send(data).catch((err: Error) => {
            this._logger.warn(`Fail send data to PTY due error: ${err.message}`);
        });
    }

    private _onOutData(data: string | undefined) {
        if (typeof data !== 'string') {
            return;
        }
        if (this._destroyed) {
            return;
        }
        this._xterm.write(data);
        this._fitAddon.fit();
        this._forceUpdate();
    }

    private _onTitleChange(title: string) {

    }

    private _onSessionChange() {
        this._dispose();
        this._create();
    }

    private _onResize() {
        if (this._fitAddon === undefined) {
            return;
        }
        this._fitAddon.fit();
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
/*
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


*/
