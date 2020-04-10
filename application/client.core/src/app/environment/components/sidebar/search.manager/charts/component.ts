import { Component, OnDestroy, ChangeDetectorRef, AfterContentInit, Input, EventEmitter, Output } from '@angular/core';
import { ChartRequest } from '../../../../controller/controller.session.tab.search.charts.request';
import { Subscription, Observable, Subject } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { IReorderEvent, IContextMenuEvent } from '../component';
import { MatCheckboxChange } from '@angular/material/checkbox';

@Component({
    selector: 'app-sidebar-app-searchmanager-charts',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchManagerChartsComponent implements OnDestroy, AfterContentInit {

    @Input() select: Observable<number>;
    @Input() edit: Observable<ChartRequest | undefined>;
    @Input() requests: ChartRequest[] = [];
    @Input() offset: number = 0;
    @Input() reorder: Subject<IReorderEvent>;
    @Input() selected: Subject<string>;

    // tslint:disable-next-line:no-output-on-prefix
    @Output() onContextMenu: EventEmitter<IContextMenuEvent> = new EventEmitter();

    public _ng_observables: {
        select: Observable<string>,
        edit: Observable<string>,
    };

    private _subjects: {
        select: Subject<string>,
        edit: Subject<string>,
    } = {
        select: new Subject<string>(),
        edit: new Subject<string>(),
    };
    private _selected: number = -1;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
        this._ng_observables = {
            select: this._subjects.select.asObservable(),
            edit: this._subjects.edit.asObservable(),
        };
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        if (this.select === undefined || this.edit === undefined) {
            return;
        }
        this._subscriptions.select = this.select.subscribe(this._onSelect.bind(this));
        this._subscriptions.edit = this.edit.subscribe(this._onEditIn.bind(this));
    }

    public _ng_onItemDragged(event: CdkDragDrop<ChartRequest[]>) {
        this.reorder.next({
            ddEvent: event,
            target: 'charts',
        });
    }

    public _ng_onContexMenu(event: MouseEvent, request: ChartRequest, index: number) {
        this.onContextMenu.emit({
            event: event,
            request: request,
            index: index,
        });
    }

    private _onSelect(index: number) {
        if (this.requests.length === 0 || this.requests[index - this.offset] === undefined) {
            this._selected = -1;
        } else {
            this._selected = index - this.offset;
        }
        this._subjects.select.next(this._selected === -1 ? '' : this.requests[this._selected].getGUID());
    }

    private _onEditIn(request: ChartRequest | undefined) {
        if (request === undefined) {
            if (this._selected === -1 || this.requests[this._selected] === undefined) {
                return;
            }
            this._subjects.edit.next(this.requests[this._selected].getGUID());
        } else {
            this._subjects.edit.next(request.getGUID());
        }
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
