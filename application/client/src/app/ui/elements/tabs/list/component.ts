import {
    Component,
    OnDestroy,
    Input,
    AfterViewInit,
    ChangeDetectorRef,
    ViewChild,
    ElementRef,
    ViewChildren,
    OnChanges,
    ChangeDetectionStrategy,
} from '@angular/core';
import type { QueryList } from '@angular/core';
import { ITabInternal, TabsService } from '../service';
import { TabsOptions } from '../options';
import { Subscription } from 'rxjs';
import { stop } from '@ui/env/dom';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'element-tabs-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsListComponent
    extends ChangesDetector
    implements OnDestroy, AfterViewInit, OnChanges
{
    @ViewChild('holdernode', { static: false }) _ng_holderNode!: ElementRef;
    @ViewChild('tabsnode', { static: false }) _ng_tabsNode!: ElementRef;
    @ViewChild('injectionsnode', { static: false }) _ng_injectionsNode!: ElementRef;
    @ViewChildren('tabnode', { read: ElementRef }) _ng_tabsElRegs!: QueryList<ElementRef>;

    @Input() public service!: TabsService;

    public _ng_options: TabsOptions = new TabsOptions();
    public _ng_offset: number = 0;
    public tabs: ITabInternal[] = [];

    private _subscriptions: Map<string, Subscription> = new Map();
    private _tabs: Map<string, ITabInternal> = new Map();
    private _sizes: {
        space: number;
        holder: number;
        tabs: number[];
        first: number;
    } = {
        space: 0,
        holder: 0,
        tabs: [],
        first: 0,
    };

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
        this._subscribeToWinEvents();
    }

    ngAfterViewInit() {
        this._apply();
        this._onWindowResize();
    }

    ngOnDestroy() {
        this._unsubscribe();
        this._unsubscribeToWinEvents();
    }

    ngOnChanges() {
        this._apply();
        this.detectChanges();
    }

    public _ng_onClick(tabkey: string) {
        this.service.setActive(tabkey);
        this.detectChanges();
    }

    public _ng_onTabClose(event: MouseEvent, tabkey: string) {
        this.service.remove(tabkey);
        this.detectChanges();
        return stop(event);
    }

    public _ng_isArrowsNeeded(): boolean {
        return this._sizes.space < 0;
    }

    public _ng_onLeftArrowClick() {
        if (this._sizes.first === 0) {
            return;
        }
        let offset = 0;
        let start = this._sizes.first;
        for (let i = this._sizes.first - 1; i >= 0; i -= 1) {
            if (offset + this._sizes.tabs[i] < this._sizes.holder) {
                offset += this._sizes.tabs[i];
                start = i;
            }
        }
        offset = 0;
        for (let i = 0; i < start; i += 1) {
            offset -= this._sizes.tabs[i];
        }
        this._sizes.first = start;
        this._ng_offset = offset;
        this._ng_offset = this._ng_offset > 0 ? 0 : this._ng_offset;
        this.detectChanges();
    }

    public _ng_onRightArrowClick() {
        let offset = 0;
        let hasSpace: boolean = true;
        let last: number = this._sizes.first;
        for (let i = last, max = this._sizes.tabs.length - 1; i <= max; i += 1) {
            if (offset + this._sizes.tabs[i] < this._sizes.holder) {
                offset += this._sizes.tabs[i];
                last = i;
            } else {
                hasSpace = false;
            }
        }
        if (hasSpace) {
            return;
        }
        this._sizes.first = last + (last + 1 <= this._sizes.tabs.length - 1 ? 1 : 0);
        this._ng_offset -= offset;
        this.detectChanges();
    }

    public _ng_onContextMenu(event: MouseEvent, tab: ITabInternal) {
        tab.subjects.onTitleContextMenu.next(event);
    }

    private _subscribe() {
        this._unsubscribe();
        this._subscriptions.set(
            'new',
            this.service.getObservable().new.subscribe(this.onNewTab.bind(this)),
        );
        this._subscriptions.set(
            'removed',
            this.service.getObservable().removed.subscribe(this.onRemoveTab.bind(this)),
        );
        this._subscriptions.set(
            'active',
            this.service.getObservable().active.subscribe(this.onActiveTabChange.bind(this)),
        );
        this._subscriptions.set(
            'options',
            this.service.getObservable().options.subscribe(this._onOptionsUpdated.bind(this)),
        );
        this._subscriptions.set(
            'updated',
            this.service.getObservable().updated.subscribe(this._onTabUpdated.bind(this)),
        );
    }

    private _unsubscribe() {
        this._subscriptions.forEach((subscription) => {
            subscription.unsubscribe();
        });
    }

    private _apply() {
        this._subscribe();
        this._tabs = this.service.getTabs();
        this.tabs = Array.from(this._tabs.values());
        this._getDefaultOptions();
    }

    private _subscribeToWinEvents() {
        this._onWindowResize = this._onWindowResize.bind(this);
        window.addEventListener('resize', this._onWindowResize);
    }

    private _unsubscribeToWinEvents() {
        window.removeEventListener('resize', this._onWindowResize);
    }

    private async onNewTab(tab: ITabInternal) {
        this._tabs.set(tab.uuid, await tab);
        if (tab.unshift === true) {
            this.tabs.unshift(tab);
        } else {
            this.tabs.push(tab);
        }
        this._calculateSizes().detectChanges();
    }

    private async onRemoveTab(uuid: string) {
        this._tabs.delete(uuid);
        this.tabs = this.tabs.filter((tab: ITabInternal) => {
            return tab.uuid !== uuid;
        });
        this._calculateSizes().detectChanges();
        this._checkOffset();
    }

    private async onActiveTabChange(tab: ITabInternal) {
        this._tabs.forEach((storedTab: ITabInternal, uuid: string) => {
            if (storedTab.uuid !== tab.uuid && storedTab.active) {
                storedTab.active = false;
                this._tabs.set(uuid, storedTab);
            }
            if (storedTab.uuid === tab.uuid && !storedTab.active) {
                storedTab.active = true;
                this._tabs.set(uuid, storedTab);
            }
        });
        this.detectChanges();
    }

    private async _getDefaultOptions() {
        this._ng_options = await this.service.getOptions();
        this.detectChanges();
    }

    private async _onOptionsUpdated(options: TabsOptions) {
        this._ng_options = await options;
        this._calculateSizes().detectChanges();
    }

    private async _onTabUpdated(tab: ITabInternal) {
        this._tabs.set(tab.uuid, tab);
        this.tabs = this.tabs.map((storedTab: ITabInternal) => {
            if (storedTab.uuid === tab.uuid) {
                return tab;
            }
            return storedTab;
        });
        this._calculateSizes().detectChanges();
    }

    private _calculateSizes(): TabsListComponent {
        if (this._ng_holderNode === undefined || this._ng_holderNode === null) {
            return this;
        }
        if (this._ng_tabsNode === undefined || this._ng_tabsNode === null) {
            return this;
        }
        const width: number = (
            this._ng_holderNode.nativeElement as HTMLElement
        ).getBoundingClientRect().width;
        const tabs: number = (
            this._ng_tabsNode.nativeElement as HTMLElement
        ).getBoundingClientRect().width;
        const injections: number =
            this._ng_injectionsNode !== undefined
                ? this._ng_injectionsNode !== null
                    ? (this._ng_injectionsNode.nativeElement as HTMLElement).getBoundingClientRect()
                          .width
                    : 0
                : 0;
        const space: number = Math.round(width - tabs - injections);
        // eslint-disable-next-line no-compare-neg-zero
        this._sizes.space = space === -0 ? 0 : space;
        this._sizes.holder = width;
        this._sizes.tabs = [];
        this._ng_tabsElRegs.forEach((tab: ElementRef<HTMLElement>) => {
            this._sizes.tabs.push(tab.nativeElement.getBoundingClientRect().width);
        });
        return this;
    }

    private _onWindowResize() {
        this._calculateSizes();
        this.detectChanges();
    }

    private _checkOffset() {
        if (this._sizes.first >= this._sizes.tabs.length) {
            this._ng_onLeftArrowClick();
        }
    }
}
