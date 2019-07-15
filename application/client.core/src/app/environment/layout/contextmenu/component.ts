import { Component, OnDestroy, ChangeDetectorRef, HostBinding, AfterViewInit } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { IComponentDesc } from 'logviewer-client-containers';
import ContextMenuService, { IMenu, IMenuItem } from '../../services/standalone/service.contextmenu';

@Component({
    selector: 'app-layout-contextmenu',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutContextMenuComponent implements OnDestroy, AfterViewInit {

    public _ng_component: IComponentDesc | undefined;
    public _ng_items: IMenuItem[] | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _top: number = 0;
    private _left: number = 0;

    constructor(private _cdRef: ChangeDetectorRef) {
        this._subscriptions.onShow = ContextMenuService.getObservable().onShow.subscribe(this._onShow.bind(this));
    }

    public get _ng_top() {
        return `${this._top}px`;
    }

    public get _ng_left() {
        return `${this._left}px`;
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._unsubscribeToWinEvents();
    }

    public ngAfterViewInit() {
        this._subscribeToWinEvents();
    }

    private _onShow(menu: IMenu) {
        this._ng_component = menu.component;
        this._ng_items = menu.items;
        this._top = menu.y;
        this._left = menu.x;
        this._cdRef.detectChanges();
    }

    private _subscribeToWinEvents() {
        this._onWindowMouseDown = this._onWindowMouseDown.bind(this);
        window.addEventListener('mousedown', this._onWindowMouseDown);
    }

    private _unsubscribeToWinEvents() {
        window.removeEventListener('mousedown', this._onWindowMouseDown);
    }

    private _onWindowMouseDown() {
        this._ng_component = undefined;
        this._ng_items = undefined;
        this._top = 0;
        this._left = 0;
        this._cdRef.detectChanges();
    }

}
