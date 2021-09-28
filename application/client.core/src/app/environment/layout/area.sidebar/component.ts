import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { TabsService, TabsOptions, ETabsListDirection } from 'chipmunk-client-material';
import { Session } from '../../controller/session/session';
import { AreaState } from '../state';
import { Subscription } from 'rxjs';
import { LayoutSessionSidebarControlsComponent } from './controls/component';

import EventsSessionService from '../../services/standalone/service.events.session';
import TabsSessionsService from '../../services/service.sessions.tabs';
import SidebarSessionsService from '../../services/service.sessions.sidebar';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-layout-func-bar',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class LayoutSessionSidebarComponent implements AfterViewInit, OnDestroy {
    @Input() public state!: AreaState;

    public _ng_tabsService: TabsService | undefined;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('LayoutSessionSidebarComponent');

    constructor(private _cdRef: ChangeDetectorRef) {}

    ngAfterViewInit() {
        if (!this.state) {
            return;
        }
        // Subscribe to change of current session
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        // Subscribe to state events
        this._subscriptions.minimized = this.state
            .getObservable()
            .minimized.subscribe(this._onMinimized.bind(this));
        this._subscriptions.updated = this.state
            .getObservable()
            .updated.subscribe(this._onUpdated.bind(this));
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

    private _onSessionChange(session: Session | undefined) {
        this._setActiveTabsService(session);
    }

    private _setActiveTabsService(session?: Session | undefined) {
        if (session === undefined || session === null) {
            session = TabsSessionsService.getActive();
        }
        this._ng_tabsService = undefined;
        if (session !== undefined && session !== null) {
            // Get tabs service
            const service: TabsService | undefined = SidebarSessionsService.getTabsService(
                session.getGuid(),
            );
            if (service !== undefined) {
                this._ng_tabsService = service;
                // Change layout of tabs in sidebar
                this._ng_tabsService.setOptions(
                    new TabsOptions({
                        injections: {
                            bar: {
                                factory: LayoutSessionSidebarControlsComponent,
                                inputs: {
                                    state: this.state,
                                },
                            },
                        },
                        direction: ETabsListDirection.left,
                        minimized: true,
                    }),
                );
            } else {
                this._logger.warn(`Fail to init sidebar because no tab's service available.`);
            }
        }
        this._cdRef.detectChanges();
    }
}
