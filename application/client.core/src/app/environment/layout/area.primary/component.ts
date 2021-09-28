import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { TabsService } from 'chipmunk-client-material';
import { AreaState } from '../state';
import { Subscription } from 'rxjs';
import { LayoutPrimiryAreaControlsComponent } from './controls/component';
import { LayoutPrimiryAreaNoTabsComponent } from './no-tabs-content/component';

import TabsSessionsService from '../../services/service.sessions.tabs';
import RenderStateService from '../../services/service.render.state';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-layout-area-primary',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class LayoutPrimaryAreaComponent implements AfterViewInit, OnDestroy {
    @Input() public state!: AreaState;

    public tabsService: TabsService;

    private _logger: Toolkit.Logger = new Toolkit.Logger('LayoutPrimaryAreaComponent');
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {
        // Get reference to tab service
        this.tabsService = TabsSessionsService.getTabsService();
        // Add controls to tab list area (button "+")
        this.tabsService.updateOptions({
            injections: {
                bar: {
                    factory: LayoutPrimiryAreaControlsComponent,
                    inputs: {
                        onNewTab: this._onNewTab.bind(this),
                    },
                },
            },
            noTabsContent: {
                factory: LayoutPrimiryAreaNoTabsComponent,
                inputs: {},
            },
        });
        // Create default session
        TabsSessionsService.add()
            .then(() => {
                RenderStateService.state().ready();
            })
            .catch((error: Error) => {
                this._logger.error(`Fail to create default tab due error: ${error.message}`);
            });
    }

    ngAfterViewInit() {
        if (!this.state) {
            return;
        }
        this._subscriptions.minimized = this.state
            .getObservable()
            .minimized.subscribe(this._onMinimized.bind(this));
        this._subscriptions.updated = this.state
            .getObservable()
            .updated.subscribe(this._onUpdated.bind(this));
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            if (this._subscriptions[key] !== null) {
                this._subscriptions[key].unsubscribe();
            }
        });
    }

    public _onTabsAreaClick() {
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

    public _onNewTab() {
        TabsSessionsService.add().catch((error: Error) => {
            this._logger.error(`Fail to open new tab due error: ${error.message}`);
        });
    }
}
