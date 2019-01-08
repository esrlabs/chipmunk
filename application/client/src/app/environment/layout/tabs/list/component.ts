import { Component, OnDestroy } from '@angular/core';
import { ITab, TabsService } from '../../../services/service.tabs';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-layout-tabs-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutTabsListComponent implements OnDestroy {

    private _tabs: Map<string, ITab> = new Map();
    private _subscriptionTabs: Subscription;
    private _subscriptionTabActive: Subscription;

    public tabs: ITab[] = [];

    constructor(private _tabService: TabsService) {
        this._subscriptionTabs = this._tabService.getObservable().subscribe(this.onNewTab.bind(this));
        this._subscriptionTabActive = this._tabService.getActiveObservable().subscribe(this.onActiveTabChange.bind(this));
    }

    ngOnDestroy() {
        this._subscriptionTabs.unsubscribe();
        this._subscriptionTabActive.unsubscribe();
    }

    public onClick(tabkey: string) {
        console.log(tabkey);
        this._tabService.setActive(tabkey);
    }

    private async onNewTab(tab: ITab) {
        this._tabs.set(tab.id, await tab);
        this.tabs.push(tab);
    }

    private async onActiveTabChange(tab: ITab) {
        this._tabs.forEach((storedTab: ITab, id: string) => {
            if (storedTab.id !== tab.id && storedTab.active) {
                storedTab.active = false;
                this._tabs.set(id, storedTab);
            }
            if (storedTab.id === tab.id && !storedTab.active) {
                storedTab.active = true;
                this._tabs.set(id, storedTab);
            }
        });
    }

}
