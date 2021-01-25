import { Component, Input, OnDestroy, ChangeDetectorRef, AfterViewInit, OnChanges } from '@angular/core';
import { ITab, TabsService } from '../service';
import { Subscription } from 'rxjs';
import { IComponentDesc } from '../../dynamic/component';

@Component({
    selector: 'lib-complex-tab-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class TabContentComponent implements OnDestroy, AfterViewInit, OnChanges {

    @Input() public service: TabsService = null;

    public _ng_tab: ITab | undefined = undefined;
    public _ng_noTabContent: IComponentDesc | undefined;

    private _destroyed: boolean = false;
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngAfterViewInit() {
        this._apply();
    }

    ngOnDestroy() {
        this._destroyed = true;
        this._unsubscribe();
    }

    ngOnChanges() {
        this._apply();
    }

    private _subscribe() {
        this._unsubscribe();
        this._subscriptions.active = this.service.getObservable().active.subscribe(this.onActiveTabChange.bind(this));
        this._subscriptions.removed = this.service.getObservable().removed.subscribe(this.onRemoveTab.bind(this));
    }

    private _unsubscribe() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _apply() {
        this._subscribe();
        this._ng_noTabContent = this.service.getOptions().noTabsContent;
        this._getDefaultTab();
    }

    private async _getDefaultTab() {
        this._ng_tab = await this.service.getActiveTab();
        this._forceUpdate();
    }

    private async onActiveTabChange(tab: ITab) {
        const _tab = await tab;
        if (_tab.active) {
            this._ng_tab = _tab;
            this._ng_noTabContent = undefined;
        }
        this._forceUpdate();
    }

    private async onRemoveTab(guid: string) {
        if (this.service.getTabs().size !== 0) {
            return;
        }
        this._ng_tab = undefined;
        this._ng_noTabContent = this.service.getOptions().noTabsContent;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
