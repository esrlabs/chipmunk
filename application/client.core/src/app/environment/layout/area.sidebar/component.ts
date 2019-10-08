import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { TabsService, TabsOptions, ETabsListDirection } from 'logviewer-client-complex';
import { ControllerSessionTab } from '../../controller/controller.session.tab';
import { AreaState } from '../state';
import { Subscription, Subject, Observable } from 'rxjs';
import TabsSessionsService from '../../services/service.sessions.tabs';
import SidebarSessionsService from '../../services/service.sessions.sidebar';
import { IComponentDesc } from 'logviewer-client-containers';
import { LayoutSessionSidebarControlsComponent } from './controls/component';
import * as Toolkit from 'logviewer.client.toolkit';

@Component({
    selector: 'app-layout-func-bar',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutSessionSidebarComponent implements AfterViewInit, OnDestroy {

    @Input() public state: AreaState;

    public _ng_tabsService: TabsService;

    private _subscriptions: { [key: string]: Subscription | undefined } = { };
    private _logger: Toolkit.Logger = new Toolkit.Logger('LayoutSessionSidebarComponent');

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngAfterViewInit() {
        if (!(this.state)) {
            return;
        }
        // Subscribe to change of current session
        this._subscriptions.onSessionChange = TabsSessionsService.getObservable().onSessionChange.subscribe(this._onSessionChange.bind(this));
        // Subscribe to state events
        this._subscriptions.minimized = this.state.getObservable().minimized.subscribe(this._onMinimized.bind(this));
        this._subscriptions.updated = this.state.getObservable().updated.subscribe(this._onUpdated.bind(this));
        // Get tabs service
        this._setActiveTabsService();
        // Update layout
        this._cdRef.detectChanges();
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            if (this._subscriptions[key] !== null) {
                this._subscriptions[key].unsubscribe();
            }
        });
    }

    public _ng_onTabsAreaClick() {
        if (!this.state.minimized) {
            return;
        }
        this.state.maximize();
    }

    private _onMinimized(minimized: boolean) {
        this._cdRef.detectChanges();
    }

    private _onUpdated(state: AreaState) {
        this._cdRef.detectChanges();
    }

    private _onSessionChange(session: ControllerSessionTab) {
        // Drop old service
        this._ng_tabsService = undefined;
        this._cdRef.detectChanges();
        // Set new service
        this._setActiveTabsService(session);
        this._cdRef.detectChanges();
    }

    private _setActiveTabsService(session?: ControllerSessionTab | undefined) {
        if (session === undefined || session === null) {
            session = TabsSessionsService.getActive();
        }
        if (session === undefined || session === null) {
            this._ng_tabsService = undefined;
            return;
        }
        // Get tabs service
        const service: TabsService | Error = SidebarSessionsService.getTabsService(session.getGuid());
        if (service === undefined) {
            this._logger.warn(`Fail to init sidebar because no tab's service available.`);
            return;
        }
        this._ng_tabsService = service;
        // Change layout of tabs in sidebar
        this._ng_tabsService.setOptions(new TabsOptions({
            injections: {
                bar: {
                    factory: LayoutSessionSidebarControlsComponent,
                    inputs: {
                        state: this.state,
                    }
                }
            },
            direction: ETabsListDirection.left,
            minimized: true
        }));
    }

}
