import { Subscription } from 'rxjs';
import { Component, OnDestroy } from '@angular/core';
import { trigger, transition, animate, style, state } from '@angular/animations';

import SearchManagerService, { EListID } from '../service/service';

@Component({
    selector: 'app-sidebar-app-searchmanager-bin',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    animations: [
        trigger('inOut', [
            state(
                'in',
                style({
                    opacity: '1',
                }),
            ),
            state(
                'out',
                style({
                    opacity: '0.0000001',
                }),
            ),
            transition('in => out', [animate('0.2s')]),
            transition('out => in', [animate('0.2s')]),
        ]),
    ],
})
export class SidebarAppSearchManagerBinComponent implements OnDestroy {
    public _ng_dragging: boolean = false;
    public _ng_listID: EListID = EListID.binList;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _droppedListID: EListID | undefined;
    private _droppedOut: boolean = false;
    private _ignore: boolean | undefined;

    constructor() {
        this._subscriptions.drag = SearchManagerService.observable.drag.subscribe(
            this._onDragStart.bind(this),
        );
        this._subscriptions.mouseOver = SearchManagerService.observable.mouseOver.subscribe(
            this._onMouseOver.bind(this),
        );
        this._subscriptions.mouseOverGlobal =
            SearchManagerService.observable.mouseOverGlobal.subscribe(
                this._onMouseOverGlobal.bind(this),
            );
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onListDropped() {
        if (this._droppedListID === this._ng_listID && !this._droppedOut) {
            SearchManagerService.onBinDrop();
        }
        this._ng_dragging = false;
    }

    private _onDragStart(status: boolean) {
        this._ng_dragging = status;
    }

    private _onMouseOver(listID: EListID) {
        if (this._ng_dragging) {
            if (listID !== this._ng_listID) {
                // Special case for bin
                this._ignore = true;
            }
            this._droppedListID = listID;
            this._droppedOut = false;
            SearchManagerService.onMouseOverBin(true);
        }
    }

    private _onMouseOverGlobal() {
        if (this._ng_dragging && !this._ignore) {
            this._droppedOut = true;
            SearchManagerService.onMouseOverBin(false);
        } else {
            this._ignore = false;
        }
    }
}
