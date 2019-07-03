import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { TabsService  } from 'logviewer-client-complex';
import { AreaState } from '../state';
import { Subscription } from 'rxjs';
import { LayoutPrimiryAreaControlsComponent } from './controls/component';
import { LayoutPrimiryAreaNoTabsComponent } from './no-tabs-content/component';
import TabsSessionsService from '../../services/service.sessions.tabs';

@Component({
    selector: 'app-layout-area-primary',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutPrimaryAreaComponent implements AfterViewInit, OnDestroy {

    @Input() public state: AreaState;

    public tabsService: TabsService;

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
                        onNewTab: this._onNewTab.bind(this)
                    }
                }
            },
            noTabsContent: {
                factory: LayoutPrimiryAreaNoTabsComponent,
                inputs: {}
            }
        });
        // Create default session
        TabsSessionsService.add();
        /*
        const options = this.tabsService.getOptions();
        options.injections.bar = {
            factory: null,
            inputs: {},
        };
        this.tabsService.setOptions(options);*/
        /*
        this.tabsService.add({
            name: 'Tab 1 (3)',
            active: true,
            content: {
                factory: DockingComponent,
                inputs: {
                    service: new DocksService('1', new DockDef.Container({
                        a: new DockDef.Dock({ caption: 'Dock 1' }),
                        b: new DockDef.Container({
                            a: new DockDef.Dock({ caption: 'Dock 2' }),
                            b: new DockDef.Dock({ caption: 'Dock 3' })
                        })
                    }))
                }
            }
        });
        */
    }

    ngAfterViewInit() {
        if (!(this.state)) {
            return;
        }
        this._subscriptions.minimized = this.state.getObservable().minimized.subscribe(this._onMinimized.bind(this));
        this._subscriptions.updated = this.state.getObservable().updated.subscribe(this._onUpdated.bind(this));
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
        TabsSessionsService.add();
    }

}
