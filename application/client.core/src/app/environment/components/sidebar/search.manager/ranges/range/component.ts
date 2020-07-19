import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit, HostBinding, NgZone, ViewChild } from '@angular/core';
import { TimeRange } from '../../../../../controller/controller.session.tab.timestamps.range';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatInput } from '@angular/material/input';
import { Subscription } from 'rxjs';
import { SidebarAppSearchManagerItemDirective } from '../../directives/item.directive';

@Component({
    selector: 'app-sidebar-app-searchmanager-timerangehook',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchManagerTimeRangeComponent implements OnDestroy, AfterContentInit {

    @ViewChild(MatInput) _inputRefCom: MatInput;

    @Input() range: TimeRange;

    public _ng_request: string = 'initialization';
    public _ng_color: string = '#431223';
    public _ng_state: boolean;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _zone: NgZone) {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        if (this.range === undefined) {
            return;
        }
        this._init();
    }

    public getInputRef(): MatInput | undefined {
        return this._inputRefCom;
    }

    public _ng_onStateChange(event: MatCheckboxChange) {
        this._forceUpdate();
    }

    public _ng_onStateClick(event: MouseEvent) {
    }

    public _ng_onRequestInputChange(request: string) {
    }

    private _init() {
        this._zone.run(() => {
            /*
            this._ng_request = desc.request;
            this._ng_color = desc.color;
            this._ng_state = desc.active;
            */
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
