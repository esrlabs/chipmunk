import { Component, Input, OnDestroy, ChangeDetectorRef, AfterContentInit, HostBinding, NgZone, ViewChild } from '@angular/core';
import { ChartRequest } from '../../../../controller/controller.session.tab.search.charts.request';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { MatInput } from '@angular/material/input';
import { Subscription, Observable, Subject } from 'rxjs';
import { SidebarAppSearchManagerItemDirective } from '../directives/item.directive';

enum RequestErrorCodes {
    NO_ERRORS = 'NO_ERRORS',
    REQUIRED = 'REQUIRED',
    INVALID = 'INVALID',
}

@Component({
    selector: 'app-sidebar-app-searchmanager-chart',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppSearchManagerChartComponent implements OnDestroy, AfterContentInit {

    @HostBinding('class.notvalid') get cssClassNotValid() {
        return !ChartRequest.isValid(this._ng_request);
    }

    @ViewChild(MatInput) _inputRefCom: MatInput;

    @Input() request: ChartRequest;

    public _ng_request: string;
    public _ng_color: string;
    public _ng_state: boolean;
    public _ng_directive: SidebarAppSearchManagerItemDirective;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef, private _zone: NgZone, private _directive: SidebarAppSearchManagerItemDirective) {
        this._ng_directive = _directive;
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        if (this.request === undefined) {
            return;
        }
        this._init();
        this._directive.setGuid(this.request.getGUID());
        this.request.onChanged(this._onRequestChanged.bind(this));
    }

    public getInputRef(): MatInput | undefined {
        return this._inputRefCom;
    }

    public _ng_onStateChange(event: MatCheckboxChange) {
        this.request.setState(event.checked);
        this._forceUpdate();
    }

    public _ng_onStateClick(event: MouseEvent) {
        this._ng_directive.ignoreMouseClick(event);
    }

    public _ng_onRequestInputChange(request: string) {
    }

    public _ng_onRequestInputKeyUp(event: KeyboardEvent) {
        switch (event.code) {
            case 'Escape':
                this._zone.run(() => {
                    this._ng_request = this.request.asDesc().request;
                    this._ng_directive.setEditFlag(false);
                    this._forceUpdate();
                });
                break;
            case 'Enter':
                this._zone.run(() => {
                    if (ChartRequest.isValid(this._ng_request)) {
                        this.request.setRequest(this._ng_request);
                    } else {
                        this._ng_request = this.request.asDesc().request;
                    }
                    this._ng_directive.setEditFlag(false);
                    this._forceUpdate();
                });
                break;
        }
    }

    public _ng_onRequestInputBlur() {
        this._zone.run(() => {
            this._ng_request = this.request.asDesc().request;
            this._ng_directive.setEditFlag(false);
            this._forceUpdate();
        });
    }

    private _init() {
        this._zone.run(() => {
            const desc = this.request.asDesc();
            this._ng_request = desc.request;
            this._ng_color = desc.color;
            this._ng_state = desc.active;
        });
    }

    private _onRequestChanged(request: ChartRequest) {
        this.request = request;
        this._init();
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
