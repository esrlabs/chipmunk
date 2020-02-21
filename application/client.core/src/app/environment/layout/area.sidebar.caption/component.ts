import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { IComponentDesc } from 'chipmunk-client-material';
import * as Toolkit from 'chipmunk.client.toolkit';
import SidebarSessionsService from '../../services/service.sessions.sidebar';

@Component({
    selector: 'app-layout-sidebar-caption',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutSessionSidebarCaptionComponent implements AfterViewInit, OnDestroy {

    public _ng_injection: IComponentDesc | undefined = undefined;
    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _logger: Toolkit.Logger = new Toolkit.Logger('LayoutSessionSidebarCaptionComponent');

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngAfterViewInit() {
        this._subscriptions.onInjectionUpdated = SidebarSessionsService.getObservable().injection.subscribe(this._onInjectionUpdated.bind(this));
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            if (this._subscriptions[key] !== null) {
                this._subscriptions[key].unsubscribe();
            }
        });
    }

    private _onInjectionUpdated(comp: IComponentDesc | undefined) {
        this._ng_injection = comp;
        this._cdRef.detectChanges();
    }

}
