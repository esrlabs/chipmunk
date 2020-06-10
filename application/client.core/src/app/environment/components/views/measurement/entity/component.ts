import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterContentInit, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { ControllerSessionTab } from '../../../../controller/controller.session.tab';
import { ChartRequest } from '../../../../controller/controller.session.tab.search.charts.request';

import OutputRedirectionsService from '../../../../services/standalone/service.output.redirections';
import ViewsEventsService from '../../../../services/standalone/service.views.events';
import ContextMenuService from '../../../../services/standalone/service.contextmenu';
import TabsSessionsService from '../../../../services/service.sessions.tabs';
import EventsSessionService from '../../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-measurement-entity',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewMeasurementEntityComponent implements AfterViewInit, AfterContentInit, OnDestroy {

    //@Input() service: ServiceData;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewMeasurementEntityComponent');
    private _destroyed: boolean = false;


    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {

    }

    ngAfterContentInit() {
    }

    ngAfterViewInit() {
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }


    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
