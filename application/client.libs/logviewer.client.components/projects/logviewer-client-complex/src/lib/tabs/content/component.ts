import { Component, Input, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { ITab, TabsService } from '../service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'lib-complex-tab-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class TabContentComponent implements OnDestroy, AfterViewInit {

    @Input() public service: TabsService = null;

    public _tab: ITab | undefined = undefined;
    private _destroyed: boolean = false;
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngAfterViewInit() {
        if (!this.service) {
            return;
        }
        this._subscriptions.active = this.service.getObservable().active.subscribe(this.onActiveTabChange.bind(this));
        this._subscriptions.removed = this.service.getObservable().removed.subscribe(this.onRemoveTab.bind(this));
        this._getDefaultTab();
    }

    ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            if (this._subscriptions[key] !== null) {
                this._subscriptions[key].unsubscribe();
            }
        });
    }

    private async _getDefaultTab() {
        this._tab = await this.service.getActiveTab();
        this._forceUpdate();
    }

    private async onActiveTabChange(tab: ITab) {
        const guid = this._tab === undefined ? undefined : this._tab.guid;
        const _tab = await tab;
        if (_tab.active && guid !== _tab.guid) {
            this._tab = _tab;
        }
        this._forceUpdate();
    }

    private async onRemoveTab(guid: string) {
        if (this.service.getTabs().size !== 0) {
            return;
        }
        this._tab = undefined;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
