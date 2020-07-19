import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit, Input, EventEmitter, Output } from '@angular/core';
import { ChartRequest } from '../../../../../controller/controller.session.tab.search.charts.request';
import { Subscription, Observable, Subject } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { IContextMenuEvent } from '../../component';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { Provider } from '../../providers/provider';
import { Entity } from '../../providers/entity';

@Component({
    selector: 'app-sidebar-app-searchmanager-charts',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchManagerChartsComponent implements OnDestroy, AfterContentInit {

    @Input() provider: Provider<ChartRequest>;

    // tslint:disable-next-line:no-output-on-prefix
    @Output() onContextMenu: EventEmitter<IContextMenuEvent> = new EventEmitter();

    public _ng_entries: Array<Entity<ChartRequest>> = [];

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        this._ng_entries = this.provider.get();
        this._subscriptions.change = this.provider.getObservable().change.subscribe(this._onDataUpdate.bind(this));
    }

    public _ng_onItemDragged(event: CdkDragDrop<ChartRequest[]>) {
        this.provider.reorder({ prev: event.previousIndex, curt: event.currentIndex });
    }

    public _ng_onContexMenu(event: MouseEvent, request: ChartRequest, index: number) {
        this.onContextMenu.emit({
            event: event,
            request: request,
            index: index,
        });
    }

    private _onDataUpdate() {
        this._ng_entries = this.provider.get();
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
