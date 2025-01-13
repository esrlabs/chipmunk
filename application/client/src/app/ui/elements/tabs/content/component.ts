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
import { IComponentDesc } from '../../containers/dynamic/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Subscriber } from '@platform/env/subscription';

@Component({
    selector: 'lib-complex-tab-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false,
})
export class TabContentComponent
    extends ChangesDetector
    implements OnDestroy, AfterViewInit, OnChanges
{
    @Input() public service!: TabsService;

    public _ng_tab: ITab | undefined = undefined;
    public _ng_noTabContent: IComponentDesc | undefined;

    private _subscriber: Subscriber = new Subscriber();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterViewInit() {
        this._apply();
    }

    ngOnDestroy() {
        this._subscriber.unsubscribe();
    }

    ngOnChanges() {
        this._apply();
    }

    private _subscribe() {
        this._subscriber.unsubscribe();
        this._subscriber.register(
            this.service.subjects.get().active.subscribe(this.onActiveTabChange.bind(this)),
            this.service.subjects.get().removed.subscribe(this.onRemoveTab.bind(this)),
        );
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
