import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit, Input, Output, EventEmitter } from '@angular/core';
import { DisabledRequest } from '../../../../../controller/controller.session.tab.search.disabled.request';
import { Subject, Observable, Subscription } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Provider } from '../../providers/provider';
import { Entity } from '../../providers/entity';

@Component({
    selector: 'app-sidebar-app-searchmanager-disableds',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class SidebarAppSearchManagerDisabledsComponent implements OnDestroy, AfterContentInit {

    @Input() provider: Provider<DisabledRequest>;

    public _ng_entries: Array<Entity<DisabledRequest>> = [];

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

    public _ng_onItemDragged(event: CdkDragDrop<DisabledRequest[]>) {
        this.provider.reorder({ prev: event.previousIndex, curt: event.currentIndex });
    }

    public _ng_onContexMenu(event: MouseEvent, entity: Entity<DisabledRequest>) {
        this.provider.select().context(event, entity);
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
