// tslint:disable:member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, HostListener, AfterContentInit, OnChanges } from '@angular/core';
import * as Toolkit from 'logviewer.client.toolkit';
import { IRequest } from '../../../../../controller/controller.session.tab.search';

export interface IRequestItem {
    request: IRequest;
    onSelect: () => void;
    onRemove: () => void;
    onChangeState: (active: boolean) => void;
}

@Component({
    selector: 'app-sidebar-app-search-request',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchRequestComponent implements OnDestroy, AfterContentInit, OnChanges {

    @Input() public request: IRequestItem;

    public _ng_request: string = '';
    public _ng_active: boolean = true;
    public _ng_color: string = '';
    public _ng_background: string = '';

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    @HostListener('click', ['$event'])

    public onClick(event: MouseEvent) {
        this.request.onSelect();
    }

    public ngAfterContentInit() {
        this._update();
    }

    public ngOnChanges() {
        this._update();
    }

    public ngOnDestroy() {
    }

    public _ng_onRemove(event: MouseEvent) {
        this.request.onRemove();
        event.stopImmediatePropagation();
        event.preventDefault();
        return false;
    }

    public _ng_onChangeState(event: MouseEvent) {
        this._ng_active = !this._ng_active;
        this.request.onChangeState(this._ng_active);
        event.stopImmediatePropagation();
        event.preventDefault();
        return false;
    }

    private _update() {
        if (this.request === undefined) {
            return;
        }
        this._ng_request = this.request.request.reg.source;
        this._ng_color = this.request.request.color;
        this._ng_background = this.request.request.background;
        this._ng_active = this.request.request.active;
        this._cdRef.detectChanges();
    }

}
