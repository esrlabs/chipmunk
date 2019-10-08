import ServiceElectronIpc, { IPCMessages, Subscription } from '../../../services/service.electron.ipc';
import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';

@Component({
    selector: 'app-apps-status-bar-stream-state',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class AppsStatusBarStreamStateComponent implements OnDestroy {

    public _ng_read: string;
    public _ng_size: string;
    public _ng_state: string;
    public _ng_progress: boolean = false;
    public _ng_processing: number = undefined;

    private _logger: Toolkit.Logger = new Toolkit.Logger('AppsStatusBarStreamStateComponent');
    private _subscriptions: { [key: string]: Subscription | undefined } = {};

    constructor(private _cdRef: ChangeDetectorRef) {
        this._subscriptions.StreamPipeState = ServiceElectronIpc.subscribe(IPCMessages.StreamPipeState, this._onStreamPipeState.bind(this));
        this._subscriptions.StreamProgressState = ServiceElectronIpc.subscribe(IPCMessages.StreamProgressState, this._onStreamProgressState.bind(this));
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _onStreamPipeState(message: IPCMessages.StreamPipeState) {
        this._drop();
        if (message.items.length > 0 && message.size > 0) {
            this._ng_progress = true;
            this._ng_size = (message.size / 1024 / 1024).toFixed(2);
            this._ng_read = ((message.done > message.size ? message.size : message.done) / 1024 / 1024).toFixed(2);
            this._ng_state = 'processing';
        }
        this._cdRef.detectChanges();
    }

    private _onStreamProgressState(message: IPCMessages.StreamProgressState) {
        this._drop();
        if (message.items.length > 0) {
            this._ng_progress = true;
            this._ng_state = 'processing';
            this._ng_processing = Math.ceil(message.progress * 100);
        }
        this._cdRef.detectChanges();
    }

    private _drop() {
        this._ng_progress = false;
        this._ng_read = undefined;
        this._ng_size = undefined;
        this._ng_state = undefined;
        this._ng_processing = undefined;
    }

}
