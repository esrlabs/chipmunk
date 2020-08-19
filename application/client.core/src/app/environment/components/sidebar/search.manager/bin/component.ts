import { Component } from '@angular/core';
import { trigger, transition, animate, style, state } from '@angular/animations';

import SearchManagerService from '../service/service';

@Component({
    selector: 'app-sidebar-app-searchmanager-bin',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    animations: [
        trigger('inOut', [
            state('in', style({
                opacity: '1',
            })),
            state('out', style({
                opacity: '0.0000001',
            })),
            transition('in => out', [
                animate('0.2s')
            ]),
            transition('out => in', [
                animate('0.2s')
            ]),
        ]),
    ],
})

export class SidebarAppSearchManagerBinComponent {

    public _ng_dragging: boolean = false;

    constructor() {
        SearchManagerService.getObservable().drag.subscribe(this._onDragStart.bind(this));
    }

    public _ng_onListDropped() {
        SearchManagerService.onBinDrop();
        this._ng_dragging = false;
    }

    private _onDragStart(status: boolean) {
        this._ng_dragging = status;
    }

}
