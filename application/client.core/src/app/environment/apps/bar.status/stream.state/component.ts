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
    public _ng_processing: string;

    private _logger: Toolkit.Logger = new Toolkit.Logger('AppsStatusBarStreamStateComponent');
    private _subscriptions: { [key: string]: Subscription | undefined } = {};

    constructor(private _cdRef: ChangeDetectorRef) {
        this._subscriptions.StreamPipeState = ServiceElectronIpc.subscribe(IPCMessages.StreamPipeState, this._onStreamPipeState.bind(this));
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _onStreamPipeState(message: IPCMessages.StreamPipeState) {
        if (message.items.length === 0 || message.size <= 0) {
            this._ng_progress = false;
            this._ng_read = undefined;
            this._ng_size = undefined;
            this._ng_state = undefined;
        } else {
            this._ng_progress = true;
            this._ng_size = (message.size / 1024 / 1024).toFixed(2);
            this._ng_read = ((message.done > message.size ? message.size : message.done) / 1024 / 1024).toFixed(2);
            this._ng_state = 'processing';
        }
        this._cdRef.detectChanges();
    }

}
