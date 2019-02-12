import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { TabsService, TabsOptions, ETabsListDirection } from 'logviewer-client-complex';
import { AreaState } from '../state';
import { Subscription } from 'rxjs';
import { LayoutSecondaryAreaControlsComponent } from './controls/component';

@Component({
    selector: 'app-layout-area-secondary',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutSecondaryAreaComponent implements AfterViewInit, OnDestroy {

    @Input() public state: AreaState;

    public tabsService: TabsService = new TabsService();

    private _subscriptions: {
        minimized: Subscription | null,
        updated: Subscription | null,
    } = {
        minimized: null,
        updated: null,
    };

    constructor(private _cdRef: ChangeDetectorRef) {
        this.tabsService.add({
            name: 'Search Results',
            active: true,
        });
        this.tabsService.add({
            name: 'Terminal',
            active: false,
        });
    }

    ngAfterViewInit() {
        if (!(this.state)) {
            return;
        }
        this.tabsService.setOptions(new TabsOptions({ injections: { bar: {
            factory: LayoutSecondaryAreaControlsComponent,
            inputs: { state: this.state }
        }}}));
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
}
