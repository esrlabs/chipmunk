// tslint:disable: member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, HostBinding, HostListener, AfterContentInit, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { ControllerFileMergeSession, IMergeFile, ITimeScale, EViewMode } from '../../../../controller/controller.file.merge.session';

import ContextMenuService from '../../../../services/standalone/service.contextmenu';

const CPadding = 12;

@Component({
    selector: 'app-sidebar-app-comments-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppCommentsItemComponent implements OnDestroy, AfterContentInit, AfterViewInit, OnChanges {

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    public ngAfterContentInit() {
    }

    public ngAfterViewInit() {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngOnChanges(changes: SimpleChanges) {
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
