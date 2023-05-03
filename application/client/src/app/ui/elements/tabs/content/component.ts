import {
    Component,
    Input,
    OnDestroy,
    ChangeDetectorRef,
    AfterViewInit,
    OnChanges,
    ChangeDetectionStrategy,
} from '@angular/core';
import { ITab, TabsService } from '../service';
import { Subscription } from 'rxjs';
import { IComponentDesc } from '../../containers/dynamic/component';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'lib-complex-tab-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabContentComponent
    extends ChangesDetector
    implements OnDestroy, AfterViewInit, OnChanges
{
    @Input() public service!: TabsService;

    public _ng_tab: ITab | undefined = undefined;
    public _ng_noTabContent: IComponentDesc | undefined;

    private _subscriptions: Map<string, Subscription> = new Map();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterViewInit() {
        this._apply();
    }

    ngOnDestroy() {
        this._unsubscribe();
    }

    ngOnChanges() {
        this._apply();
    }

    private _subscribe() {
        this._unsubscribe();
        this._subscriptions.set(
            'active',
            this.service.getObservable().active.subscribe(this.onActiveTabChange.bind(this)),
        );
        this._subscriptions.set(
            'removed',
            this.service.getObservable().removed.subscribe(this.onRemoveTab.bind(this)),
        );
    }

    private _unsubscribe() {
        this._subscriptions.forEach((subscription) => {
            subscription.unsubscribe();
        });
    }

    private _apply() {
        this._subscribe();
        this._ng_noTabContent = this.service.getOptions().noTabsContent;
        this._getDefaultTab();
    }

    private async _getDefaultTab() {
        this._ng_tab = await this.service.getActiveTab();
        this.detectChanges();
    }

    private async onActiveTabChange(tab: ITab) {
        const _tab = await tab;
        if (_tab.active) {
            this._ng_tab = _tab;
            this._ng_noTabContent = undefined;
        }
        this.detectChanges();
    }

    private async onRemoveTab() {
        if (this.service.getTabs().size !== 0) {
            return;
        }
        this._ng_tab = undefined;
        this._ng_noTabContent = this.service.getOptions().noTabsContent;
        this.detectChanges();
    }
}
