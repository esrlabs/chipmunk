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
} from '@angular/core';
import type { QueryList } from '@angular/core';
import { ITabInternal, TabsService } from '../service';
import { TabsOptions } from '../options';
import { Subscription } from 'rxjs';

@Component({
    selector: 'lib-complex-tabs-list',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class TabsListComponent implements OnDestroy, AfterViewInit, OnChanges {
    @ViewChild('holdernode', { static: false }) _ng_holderNode: ElementRef;
    @ViewChild('tabsnode', { static: false }) _ng_tabsNode: ElementRef;
    @ViewChild('injectionsnode', { static: false }) _ng_injectionsNode: ElementRef;
    @ViewChildren('tabnode', { read: ElementRef }) _ng_tabsElRegs: QueryList<ElementRef>;

    @Input() public service: TabsService = null;

    public _ng_options: TabsOptions = new TabsOptions();
    public _ng_offset: number = 0;
    public tabs: ITabInternal[] = [];

    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;
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

    constructor(private _cdRef: ChangeDetectorRef) {
        this._subscribeToWinEvents();
    }

    ngAfterViewInit() {
        this._apply();
        this._onWindowResize(null);
    }

    ngOnDestroy() {
        this._destroyed = true;
        this._unsubscribe();
        this._unsubscribeToWinEvents();
    }

    ngOnChanges() {
        this._apply();
        this._forceUpdate();
    }

    public _ng_onClick(tabkey: string) {
        this.service.setActive(tabkey);
        this._forceUpdate();
    }

    public _ng_onTabClose(event: MouseEvent, tabkey: string) {
        this.service.remove(tabkey);
        event.stopImmediatePropagation();
        event.preventDefault();
        this._forceUpdate();
        return false;
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
        this._forceUpdate();
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
        this._forceUpdate();
    }

    public _ng_onContextMenu(event: MouseEvent, tab: ITabInternal) {
        tab.subjects.onTitleContextMenu.next(event);
    }

    private _subscribe() {
        this._unsubscribe();
        this._subscriptions.new = this.service
            .getObservable()
            .new.subscribe(this.onNewTab.bind(this));
        this._subscriptions.removed = this.service
            .getObservable()
            .removed.subscribe(this.onRemoveTab.bind(this));
        this._subscriptions.active = this.service
            .getObservable()
            .active.subscribe(this.onActiveTabChange.bind(this));
        this._subscriptions.options = this.service
            .getObservable()
            .options.subscribe(this._onOptionsUpdated.bind(this));
        this._subscriptions.updated = this.service
            .getObservable()
            .updated.subscribe(this._onTabUpdated.bind(this));
    }

    private _unsubscribe() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
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
        this._tabs.set(tab.guid, await tab);
        if (tab.unshift === true) {
            this.tabs.unshift(tab);
        } else {
            this.tabs.push(tab);
        }
        this._forceUpdate(true);
    }

    private async onRemoveTab(guid: string) {
        this._tabs.delete(guid);
        this.tabs = this.tabs.filter((tab: ITabInternal) => {
            return tab.guid !== guid;
        });
        this._forceUpdate(true);
        this._checkOffset();
    }

    private async onActiveTabChange(tab: ITabInternal) {
        this._tabs.forEach((storedTab: ITabInternal, guid: string) => {
            if (storedTab.guid !== tab.guid && storedTab.active) {
                storedTab.active = false;
                this._tabs.set(guid, storedTab);
            }
            if (storedTab.guid === tab.guid && !storedTab.active) {
                storedTab.active = true;
                this._tabs.set(guid, storedTab);
            }
        });
        this._forceUpdate();
    }

    private async _getDefaultOptions() {
        this._ng_options = await this.service.getOptions();
        this._forceUpdate();
    }

    private async _onOptionsUpdated(options: TabsOptions) {
        this._ng_options = await options;
        this._forceUpdate(true);
    }

    private async _onTabUpdated(tab: ITabInternal) {
        this._tabs.set(tab.guid, tab);
        this.tabs = this.tabs.map((storedTab: ITabInternal) => {
            if (storedTab.guid === tab.guid) {
                return tab;
            }
            return storedTab;
        });
        this._forceUpdate(true);
    }

    private _calculateSizes(): number {
        if (this._ng_holderNode === undefined || this._ng_holderNode === null) {
            return Infinity;
        }
        if (this._ng_tabsNode === undefined || this._ng_tabsNode === null) {
            return Infinity;
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
        this._sizes.space = space === -0 ? 0 : space;
        this._sizes.holder = width;
        this._sizes.tabs = [];
        this._ng_tabsElRegs.forEach((tab: ElementRef<HTMLElement>) => {
            this._sizes.tabs.push(tab.nativeElement.getBoundingClientRect().width);
        });
    }

    private _onWindowResize(event: Event | null) {
        this._calculateSizes();
        this._forceUpdate();
    }

    private _checkOffset() {
        if (this._sizes.first >= this._sizes.tabs.length) {
            this._ng_onLeftArrowClick();
        }
    }

    private _forceUpdate(updateSize: boolean = false) {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
        if (updateSize) {
            this._calculateSizes();
            this._cdRef.detectChanges();
        }
    }
}
