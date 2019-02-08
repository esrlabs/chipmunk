import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import ServiceElectronIpc from '../../../../electron/services/electron.ipc';
import { IPCMessages, Subscription } from '../../../../electron/services/electron.ipc';

@Component({
    selector: 'app-apps-status-bar-electron-state',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class AppsStatusBarElectronStateComponent implements OnDestroy, AfterViewInit {

    public ng_current: string = 'waiting...';
    public ng_history: string[] = [];
    public ng_showHistory: boolean = false;

    private _subscriptions: { [key: string]: Subscription | undefined } = {
        state: undefined,
        history: undefined
    };

    constructor(private _cdRef: ChangeDetectorRef) {
        this._onHostStateChanged = this._onHostStateChanged.bind(this);
        this._onHostStateHistory = this._onHostStateHistory.bind(this);
        ServiceElectronIpc.subscribe(IPCMessages.HostState, this._onHostStateChanged).then((subscription: Subscription) => {
            this._subscriptions.state = subscription;
        }).catch((error: Error) => {
            this._subscriptions.state = undefined;
        });
        ServiceElectronIpc.subscribe(IPCMessages.HostStateHistory, this._onHostStateHistory).then((subscription: Subscription) => {
            this._subscriptions.history = subscription;
        }).catch((error: Error) => {
            this._subscriptions.history = undefined;
        });
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    ngAfterViewInit() {
        ServiceElectronIpc.send(IPCMessages.HostState, new IPCMessages.HostState({}));
        ServiceElectronIpc.send(IPCMessages.HostStateHistory, new IPCMessages.HostStateHistory({}));
    }

    private _ng_onToggleHistory() {
        if (this.ng_history.length === 0) {
            this.ng_showHistory = false;
        } else {
            this.ng_showHistory = !this.ng_showHistory;
        }
    }

    private _onHostStateChanged(state: IPCMessages.HostState) {
        if (state.state === IPCMessages.HostState.States.ready) {
            this.ng_current = 'ready';
        } else if (state.message !== '') {
            this.ng_current = state.message;
            this.ng_history.push(state.message);
        } else {
            this.ng_current = '';
        }
        this._cdRef.detectChanges();
    }

    private _onHostStateHistory(state: IPCMessages.HostStateHistory) {
        this.ng_history.unshift(...state.history);
        this._cdRef.detectChanges();
    }

}
