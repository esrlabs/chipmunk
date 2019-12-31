import { Component, ChangeDetectorRef, AfterViewInit, Input, OnDestroy } from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { IPCMessages } from '../../../../services/service.electron.ipc';

@Component({
    selector: 'app-apps-status-bar-electron-state-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class TasksHistoryComponent implements AfterViewInit, OnDestroy {

    @Input() public tasks: IPCMessages.IStreamProgressTrack[];
    @Input() public updated: Observable<IPCMessages.IStreamProgressTrack[]>;

    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    ngAfterViewInit() {
        this._subscriptions.onUpdate = this.updated.subscribe(this._onUpdate.bind(this));
    }

    private _onUpdate(tasks: IPCMessages.IStreamProgressTrack[]) {
        this.tasks = tasks;
        this._cdRef.markForCheck();
    }

}
