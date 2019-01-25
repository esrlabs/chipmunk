import { Component, OnDestroy, Input, AfterViewInit } from '@angular/core';
import { ITab, TabsService } from '../service';
import { TabsOptions, ETabsListDirection } from '../options';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-tabs-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class TabsListComponent implements OnDestroy, AfterViewInit {

    @Input() public service: TabsService = null;

    private _subscriptions: {
        new: Subscription | null,
        clear: Subscription | null,
        active: Subscription | null,
        options: Subscription | null,
    } = {
        new: null,
        clear: null,
        active: null,
        options: null,
    };

    private _tabs: Map<string, ITab> = new Map();
    private _options: TabsOptions = new TabsOptions();

    public tabs: ITab[] = [];

    constructor() {
    }

    ngAfterViewInit() {
        if (!this.service) {
            return;
        }
        this._subscriptions.new = this.service.getObservable().new.subscribe(this.onNewTab.bind(this));
        this._subscriptions.active = this.service.getObservable().active.subscribe(this.onActiveTabChange.bind(this));
        this._subscriptions.options = this.service.getObservable().options.subscribe(this._onOptionsUpdated.bind(this));
        this._tabs = this.service.getTabs();
        this._tabs.forEach((tab: ITab) => {
            this.tabs.push(tab);
        });
        this._getDefaultOptions();
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            if (this._subscriptions[key] !== null) {
                this._subscriptions[key].unsubscribe();
            }
        });
    }

    public onClick(tabkey: string) {
        console.log(tabkey);
        this.service.setActive(tabkey);
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

    private async _getDefaultOptions() {
        this._options = await this.service.getOptions();
    }

    private async _onOptionsUpdated(options: TabsOptions) {
        this._options = await options;
    }

}
