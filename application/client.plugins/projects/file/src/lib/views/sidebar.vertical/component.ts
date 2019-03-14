// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ElementRef, ViewChild } from '@angular/core';
import { EHostEvents, EHostCommands } from '../../common/host.events';
import * as Toolkit from 'logviewer.client.toolkit';
import * as Electron from 'electron';
import { debug } from 'util';

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

    public _ng_file: string;
    public _ng_read: string;
    public _ng_size: string;

    private _file: string;
    private _size: number;
    private _read: number;

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
    }

    public _ng_onOpenClick() {
        debugger;
        if (this._file !== undefined) {
            return;
        }
        Electron.remote.dialog.showOpenDialog({
            properties: ['openFile', 'showHiddenFiles']
        }, (files: string[]) => {
            if (!(files instanceof Array) || files.length !== 1) {
                return;
            }
            this.ipc.requestToHost({
                streamId: this.session,
                command: EHostCommands.open,
                file: files[0]
            }, this.session).then((response) => {
                console.log(response);
            });
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
            case EHostEvents.started:
                this._file = message.file;
                this._size = message.size;
                this._read = 0;
                break;
            case EHostEvents.finished:
                this._file = undefined;
                this._size = undefined;
                this._read = undefined;
                this._ng_file = undefined;
                this._ng_size = undefined;
                this._ng_read = undefined;
                break;
            case EHostEvents.state:
                this._read = message.read;
                break;
        }
        this._updateInfo();
    }

    private _updateInfo() {
        if (this._file !== undefined) {
            this._ng_file = this._file;
            this._ng_size = (this._size / 1024).toFixed(2);
            this._ng_read = (this._read / 1024).toFixed(2);
        }
        this._cdRef.detectChanges();
    }

}
