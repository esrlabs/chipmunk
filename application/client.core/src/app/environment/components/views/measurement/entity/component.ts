import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterContentInit, OnChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { IRange, ControllerSessionTabTimestamp, IState } from '../../../../controller/controller.session.tab.timestamp';

import OutputRedirectionsService from '../../../../services/standalone/service.output.redirections';
import ViewsEventsService from '../../../../services/standalone/service.views.events';
import ContextMenuService from '../../../../services/standalone/service.contextmenu';
import TabsSessionsService from '../../../../services/service.sessions.tabs';
import EventsSessionService from '../../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

export enum EViewType {
    scope = 'scope',
    measure = 'measure',
}

export enum EViewContent {
    details = 'details',
    minimal = 'minimal',
}

@Component({
    selector: 'app-views-measurement-entity',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewMeasurementEntityComponent implements AfterViewInit, AfterContentInit, OnDestroy, OnChanges {

    @Input() range: IRange;
    @Input() controller: ControllerSessionTabTimestamp;
    @Input() width: number;
    @Input() type: EViewType = EViewType.scope;
    @Input() content: EViewContent = EViewContent.details;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewMeasurementEntityComponent');
    private _destroyed: boolean = false;
    private _scale: {
        left: number;
        width: number;
    } = {
        left: -1,
        width: -1,
    };

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {

    }

    ngAfterContentInit() {
    }

    ngAfterViewInit() {
        this._update();
    }

    ngOnChanges() {
        this._update();
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_isScaleVisible(): boolean {
        return this._scale.left !== -1;
    }

    public _ng_getScaleStyle(): { [key: string]: string | number } {
        if (!this._ng_isScaleVisible()) {
            return {};
        }
        return {
            left: this._scale.left + 'px',
            width: this._scale.width + 'px',
        };
    }

    private _update() {
        if (this.range.end === undefined) {
            return;
        }
        const state = this.controller.getState();
        if (state.duration <= 0) {
            return;
        }
        const rate: number = this.width / state.duration;
        switch (this.type) {
            case EViewType.scope:
                this._scale.left = (this.range.start.timestamp - state.min) * rate;
                this._scale.width = Math.abs(this.range.start.timestamp - this.range.end.timestamp) * rate;
                break;
            case EViewType.measure:
                this._scale.left = 0;
                this._scale.width = Math.abs(this.range.start.timestamp - this.range.end.timestamp) * rate;
                break;
        }
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
