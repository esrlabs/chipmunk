import { Component, Input, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { ITab, TabsService } from '../service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-tab-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class TabContentComponent implements OnDestroy, AfterViewInit {

    @Input() public service: TabsService = null;

    private _tab: ITab | null = null;
    private _subscriptionTabActive: Subscription;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngAfterViewInit() {
        if (this.service === null) {
            return;
        }
        this._subscriptionTabActive = this.service.getActiveObservable().subscribe(this.onActiveTabChange.bind(this));
        this._getDefaultTab();
    }

    ngOnDestroy() {
        this._subscriptionTabActive.unsubscribe();
    }

    private async _getDefaultTab() {
        this._tab = await this.service.getActiveTab();
    }

    private async onActiveTabChange(tab: ITab) {
        const id = this._tab === null ? null : this._tab.id;
        const _tab = await tab;
        if (_tab.active && id !== _tab.id) {
            this._tab = _tab;
        }
    }

}
