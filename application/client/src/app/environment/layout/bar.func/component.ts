import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { TabsService } from '../../components/complex/tabs/service';
import { TabsOptions, ETabsListDirection } from '../../components/complex/tabs/options';
import { AreaState } from '../state';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-layout-func-bar',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutFunctionsBarComponent implements AfterViewInit, OnDestroy {

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
            name: 'Tab 1 (3)',
            active: true,
        });
        this.tabsService.add({
            name: 'Tab 2 (2)',
            active: false,
        });
        this.tabsService.add({
            name: 'Tab 3 (4)',
            active: false,
        });
        this.tabsService.add({
            name: 'Tab 4 (5)',
            active: false,
        });
        this.tabsService.add({
            name: 'Tab 5 fdfds dfs ',
            active: false,
        });
        this.tabsService.setOptions(new TabsOptions({ direction: ETabsListDirection.left, minimized: true }));
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
