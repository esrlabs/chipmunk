import { Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import QueueService, { IQueueState } from '../../../services/standalone/service.queue';
import { Subscription } from 'rxjs';
import * as Toolkit from 'chipmunk.client.toolkit';

export interface ITask {
    done: number;
    count: number;
}

@Component({
    selector: 'app-apps-status-bar-queue-state',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class AppsStatusBarQueueStateComponent implements OnDestroy {
    public _ng_tasks: Map<string, ITask> = new Map();

    private _logger: Toolkit.Logger = new Toolkit.Logger('AppsStatusBarQueueStateComponent');
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {
        this._subscriptions.next = QueueService.getObservable().next.subscribe(
            this._onNext.bind(this),
        );
        this._subscriptions.done = QueueService.getObservable().done.subscribe(
            this._onDone.bind(this),
        );
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _onNext(state: IQueueState) {
        // tslint:disable-next-line:prefer-const
        let task: ITask | undefined = this._ng_tasks.get(state.title);
        if (task === undefined) {
            (task as any) = {};
        }
        task!.count = state.count;
        task!.done = state.done;
        this._ng_tasks.set(state.title, task!);
        this._cdRef.detectChanges();
    }

    private _onDone(title: string) {
        this._ng_tasks.delete(title);
        this._cdRef.detectChanges();
    }
}
