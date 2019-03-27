// tslint:disable:no-inferrable-types

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, Input, ElementRef, ViewChild } from '@angular/core';
import { EHostEvents, EHostCommands } from '../../common/host.events';
import * as Toolkit from 'logviewer.client.toolkit';

@Component({
    selector: Toolkit.EViewsTypes.tasksBar,
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class TaskbarStateComponent implements AfterViewInit, OnDestroy {
    @Input() public ipc: Toolkit.PluginIPC;
    @Input() public session: string;

    public _ng_read: string;
    public _ng_size: string;
    public _ng_state: string;
    public _ng_progress: boolean = false;
    public _ng_processing: string;

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
            this._onIncomeMessage(message);
        });
    }

    private _onIncomeMessage(message: any) {
        if (typeof message.event === 'string') {
            // Process events
            return this._onIncomeEvent(message);
        }
    }

    /*
                            PluginIPCService.sendToPluginHost({
                            event: 'processing',
                            streamId: streamId,
                            iterationsAll: iterations,
                            iterationsLeft: iteration
                        });
    */

    private _onIncomeEvent(message: any) {
        switch (message.event) {
            case EHostEvents.started:
                this._file = message.file;
                this._size = message.size;
                this._read = 0;
                this._ng_state = 'loading';
                this._ng_progress = true;
                break;
            case EHostEvents.finished:
                this._file = undefined;
                this._size = undefined;
                this._read = undefined;
                this._ng_size = undefined;
                this._ng_read = undefined;
                this._ng_state = undefined;
                this._ng_progress = false;
                break;
            case EHostEvents.finished:
                this._file = undefined;
                this._size = undefined;
                this._read = undefined;
                this._ng_size = undefined;
                this._ng_read = undefined;
                this._ng_state = undefined;
                this._ng_processing = undefined;
                this._ng_progress = false;
                break;
            case EHostEvents.state:
                this._read = message.read;
                break;
            case EHostEvents.processing:
                this._ng_processing = ((1 - message.iterationsLeft / message.iterationsAll) * 100).toFixed(0);
                break;
        }
        this._updateInfo();
    }

    private _updateInfo() {
        if (this._file !== undefined) {
            this._ng_size = (this._size / 1024 / 1024).toFixed(2);
            this._ng_read = (this._read / 1024 / 1024).toFixed(2);
            if (this._ng_size === this._ng_read) {
                this._ng_size = undefined;
                this._ng_read = undefined;
                this._ng_state = 'processing';
            }
        }
        this._cdRef.detectChanges();
    }

}
