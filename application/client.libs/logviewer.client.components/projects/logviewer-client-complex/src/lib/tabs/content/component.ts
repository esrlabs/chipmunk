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

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngAfterViewInit() {
        if (!this.service) {
            return;
        }
        this._subscriptions.active = this.service.getObservable().active.subscribe(this.onActiveTabChange.bind(this));
        this._getDefaultTab();
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            if (this._subscriptions[key] !== null) {
                this._subscriptions[key].unsubscribe();
            }
        });
    }

    private async _getDefaultTab() {
        this._tab = await this.service.getActiveTab();
    }

    private async onActiveTabChange(tab: ITab) {
        const guid = this._tab === undefined ? undefined : this._tab.guid;
        const _tab = await tab;
        if (_tab.active && guid !== _tab.guid) {
            this._tab = _tab;
        }
    }

}
