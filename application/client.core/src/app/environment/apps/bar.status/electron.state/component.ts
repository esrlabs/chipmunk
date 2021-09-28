import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import ServiceElectronIpc, { IPC, Subscription } from '../../../services/service.electron.ipc';
import { IComponentDesc, IFrameOptions } from 'chipmunk-client-material';
import { StateHistoryComponent } from './history/component';
import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-apps-status-bar-electron-state',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class AppsStatusBarElectronStateComponent implements OnDestroy, AfterViewInit {
    public ng_current: string = 'waiting';
    public ng_showHistory: boolean = false;
    public ng_frame_options: IFrameOptions = {
        closable: true,
        caption: 'Host notifications',
        onClose: undefined,
        style: {
            maxHeight: '14rem',
        },
    };
    public ng_component: IComponentDesc = {
        factory: StateHistoryComponent,
        inputs: {
            history: [],
        },
    };

    private _logger: Toolkit.Logger = new Toolkit.Logger('AppsStatusBarElectronStateComponent');
    private _history: string[] = [];
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {
        this._ipc_onHostStateChanged = this._ipc_onHostStateChanged.bind(this);
        this._ipc_onHostStateHistory = this._ipc_onHostStateHistory.bind(this);
        this._subscriptions.state = ServiceElectronIpc.subscribe(
            IPC.HostState,
            this._ipc_onHostStateChanged,
        );
        this._subscriptions.history = ServiceElectronIpc.subscribe(
            IPC.HostStateHistory,
            this._ipc_onHostStateHistory,
        );
        this._ng_onToggleHistory = this._ng_onToggleHistory.bind(this);
        this.ng_frame_options.onClose = this._ng_onToggleHistory;
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    ngAfterViewInit() {
        ServiceElectronIpc.send(new IPC.HostState({}));
        ServiceElectronIpc.send(new IPC.HostStateHistory({}));
    }

    public _ng_onToggleHistory() {
        if (this._history.length === 0) {
            this.ng_showHistory = false;
        } else {
            this.ng_component.inputs.history = this._history;
            this.ng_showHistory = !this.ng_showHistory;
            this._cdRef.detectChanges();
        }
    }

    private _ipc_onHostStateChanged(state: IPC.HostState) {
        if (state.state === IPC.HostState.States.ready) {
            this.ng_current = 'ready';
        } else if (state.message !== '') {
            this.ng_current = state.message;
            this._history.push(state.message);
        } else {
            this.ng_current = '';
        }
        this._cdRef.detectChanges();
    }

    private _ipc_onHostStateHistory(state: IPC.HostStateHistory) {
        this._history.unshift(...state.history);
        this._cdRef.detectChanges();
    }
}
