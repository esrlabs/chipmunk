import { Component, Input, AfterContentInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { AreaState } from '../../state';
import { Observable, Subscription } from 'rxjs';
import { IComponentDesc } from 'chipmunk-client-material';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';
import { ITab } from '../../../services/service.sessions.sidebar';

import ToolbarSessionsService from '../../../services/service.sessions.toolbar';
import ContextMenuService from '../../../services/standalone/service.contextmenu';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-layout-area-secondary-controls',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class LayoutSecondaryAreaControlsComponent implements AfterContentInit, OnDestroy {
    @Input() public state!: AreaState;
    @Input() public injection!: Observable<IComponentDesc>;

    public _ng_injection: IComponentDesc | undefined = undefined;

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('LayoutSecondaryAreaControlsComponent');

    constructor(private _cdRef: ChangeDetectorRef) {}

    public ngAfterContentInit() {
        this._subscriptions.onInjection = this.injection.subscribe(this._onInjecton.bind(this));
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_onStateToggle(event: MouseEvent) {
        if (this.state.minimized) {
            this.state.maximize();
        } else {
            this.state.minimize();
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        return false;
    }

    public _ng_onAdd(event: MouseEvent) {
        const tabs: ITab[] | undefined = ToolbarSessionsService.getInactiveTabs();
        if (tabs === undefined || tabs.length === 0) {
            return;
        }
        const items: IMenuItem[] = tabs.map((tab: ITab) => {
            return {
                caption: tab.name,
                handler: () => {
                    if (tab.guid === undefined) {
                        this._logger.error(`Tab guid is undefined`);
                        return;
                    }
                    this.state.maximize();
                    ToolbarSessionsService.addByGuid(tab.guid);
                    ToolbarSessionsService.setActive(tab.guid, undefined, false).catch(
                        (error: Error) => this._logger.error(error.message),
                    );
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

    private _onInjecton(injection: IComponentDesc) {
        this._ng_injection = injection;
        this._cdRef.detectChanges();
    }
}
