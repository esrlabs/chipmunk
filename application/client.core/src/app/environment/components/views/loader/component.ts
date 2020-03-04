import { Component, Input, OnDestroy, ChangeDetectorRef } from '@angular/core';
import ServiceElectronIpc, { IPCMessages, Subscription } from '../../../services/service.electron.ipc';

@Component({
    selector: 'app-views-loader',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewLoaderComponent implements OnDestroy {

    @Input() public comment: string = 'Welcome to Chipmunk';

    private _subscription: Subscription;

    constructor(private _cdRef: ChangeDetectorRef) {
        this._subscription = ServiceElectronIpc.subscribe(IPCMessages.HostState, this._ipc_onHostStateChanged.bind(this));
    }

    public ngOnDestroy() {
        this._subscription.destroy();
    }

    private _ipc_onHostStateChanged(state: IPCMessages.HostState) {
        if (state.message !== '') {
            this.comment = state.message;
        }
        this._cdRef.detectChanges();
    }
}
