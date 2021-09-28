import { Component, Input, AfterContentInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';
import { AreaState } from '../../state';
import { ITab } from '../../../services/service.sessions.sidebar';

import SidebarSessionsService from '../../../services/service.sessions.sidebar';
import ContextMenuService from '../../../services/standalone/service.contextmenu';

@Component({
    selector: 'app-layout-area-secondary-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class LayoutSessionSidebarControlsComponent implements AfterContentInit, OnDestroy {
    @Input() public state!: AreaState;

    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(private _cdRef: ChangeDetectorRef) {}

    ngAfterContentInit() {}

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onAdd(event: MouseEvent) {
        const tabs: ITab[] | undefined = SidebarSessionsService.getAvailableTabs();
        if (tabs === undefined || tabs.length === 0) {
            return;
        }
        const items: IMenuItem[] = tabs.map((tab: ITab) => {
            return {
                caption: tab.name,
                handler: () => {
                    if (tab.guid === undefined) {
                        return;
                    }
                    this.state.maximize();
                    SidebarSessionsService.addByGuid(tab.guid);
                },
            };
        });
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }
}
