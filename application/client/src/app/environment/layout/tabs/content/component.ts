import { Component, Input, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { DocksService } from '../../../services/service.docks';
import { ITab, TabsService } from '../../../services/service.tabs';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-layout-tab-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class LayoutTabContentComponent implements OnDestroy {

    private _tab: ITab | null = null;

    public service: DocksService | null = null;
    private _subscriptionTabActive: Subscription;

    constructor(private _tabService: TabsService, private _cdRef: ChangeDetectorRef) {
        this._subscriptionTabActive = this._tabService.getActiveObservable().subscribe(this.onActiveTabChange.bind(this));
    }

    ngOnDestroy() {
        this._subscriptionTabActive.unsubscribe();
    }

    private async onActiveTabChange(tab: ITab) {
        const id = this._tab === null ? null : this._tab.id;
        const _tab = await tab;
        if (_tab.active && id !== _tab.id) {
            this._tab = _tab;
            this.service = new DocksService(this._tab.id, this._tab.dock);
            // this._cdRef.detectChanges();
        }
    }

}
