import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, AfterViewInit, ViewContainerRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { ControllerSessionTabTimestamp, IRange } from '../../../controller/controller.session.tab.timestamp';
import { EViewType, EViewContent } from './entity/component';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';

import TabsSessionsService from '../../../services/service.sessions.tabs';
import EventsSessionService from '../../../services/standalone/service.events.session';
import ViewsEventsService from '../../../services/standalone/service.views.events';
import ContextMenuService from '../../../services/standalone/service.contextmenu';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-measurement',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewMeasurementComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    public _ng_ranges: IRange[] = [];
    public _ng_width: number = 0;
    public _ng_type: EViewType = EViewType.scope;
    public _ng_content: EViewContent = EViewContent.details;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _sessionSubscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewMeasurementComponent');
    private _session: ControllerSessionTab | undefined;
    private _destroy: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
    }

    public ngOnDestroy() {
        this._destroy = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        Object.keys(this._sessionSubscriptions).forEach((key: string) => {
            this._sessionSubscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {

    }

    public ngAfterViewInit() {
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(
            this._onSessionChange.bind(this),
        );
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(
            this._onResize.bind(this),
        );
        this._onResize();
        this._onSessionChange(TabsSessionsService.getActive());
    }

    public _ng_getController(): ControllerSessionTabTimestamp {
        return this._session.getTimestamp();
    }

    public _ng_onContexMenu(event: MouseEvent, range: IRange | undefined) {
        if (this._session === undefined) {
            event.stopImmediatePropagation();
            event.preventDefault();
            return;
        }
        const items: IMenuItem[] = [
            {
                caption: `Switch to: ${this._ng_content === EViewContent.details ? 'minimal view' : 'detailed view'}`,
                handler: () => {
                    this._ng_content = this._ng_content === EViewContent.details ? EViewContent.minimal : EViewContent.details;
                    this._forceUpdate();
                },
            },
            {
                caption: `Align: ${this._ng_type === EViewType.scope ? 'all to left' : 'in scope'}`,
                handler: () => {
                    this._ng_type = this._ng_type === EViewType.scope ? EViewType.measure : EViewType.scope;
                    this._forceUpdate();
                },
            },
            { /* Delimiter */},
            {
                caption: `Remove`,
                handler: () => {
                    this._forceUpdate();
                },
                disabled: range === undefined,
            },
            {
                caption: `Remove All`,
                handler: () => {
                    this._forceUpdate();
                },
                disabled: this._session.getTimestamp().getCount() === 0,
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    private _onSessionChange(controller?: ControllerSessionTab) {
        Object.keys(this._sessionSubscriptions).forEach((key: string) => {
            this._sessionSubscriptions[key].unsubscribe();
        });
        if (controller === undefined) {
            return;
        }
        this._sessionSubscriptions.change = controller.getTimestamp().getObservable().change.subscribe(this._onRangeChange.bind(this));
        this._sessionSubscriptions.update = controller.getTimestamp().getObservable().update.subscribe(this._onRangesUpdated.bind(this));
        this._session = controller;
        this._refresh();
    }

    private _refresh(ranges?: IRange[]) {
        this._ng_ranges = ranges instanceof Array ? ranges : this._session.getTimestamp().getRanges();
        this._forceUpdate();
    }

    private _onRangeChange(range: IRange) {
        this._refresh();
    }

    private _onRangesUpdated(ranges: IRange[]) {
        this._refresh(ranges);
    }

    private _onResize() {
        this._ng_width = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect().width;
    }

    private _forceUpdate() {
        if (this._destroy) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
