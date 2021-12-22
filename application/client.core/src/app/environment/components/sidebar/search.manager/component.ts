import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    AfterViewInit,
    HostBinding,
    HostListener,
    ElementRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Session } from '../../../controller/session/session';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';
import { Providers } from './providers/holder';
import { Provider, EProviders, ISelectEvent, IContextMenuEvent } from './providers/provider';
import { ProviderFilters } from './filters/provider';
import { ProviderCharts } from './charts/provider';
import { ProviderRanges } from './ranges/provider';
import { ProviderDisabled } from './disabled/provider';

import SearchManagerService from './service/service';
import ContextMenuService from '../../../services/standalone/service.contextmenu';
import TabsSessionsService from '../../../services/service.sessions.tabs';
import EventsSessionService from '../../../services/standalone/service.events.session';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-sidebar-app-searchmanager',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppSearchManagerComponent implements OnDestroy, AfterViewInit {
    public _ng_providers: Provider<any>[] = [];
    public _ng_selected: Provider<any> | undefined;

    private _providers: Providers = new Providers();
    private _session: Session | undefined;
    private _focused: boolean = false;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;

    @HostBinding('attr.tabindex') get tabindex() {
        return 0;
    }
    @HostListener('focus', ['$event.target']) onFocus() {
        this._focused = true;
    }
    @HostListener('blur', ['$event.target']) onBlur() {
        this._focused = false;
    }
    @HostListener('contextmenu', ['$event']) onContextMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: `Clear recent history`,
                handler: () => {
                    this._session !== undefined &&
                        this._session
                            .getSessionSearch()
                            .getStoreAPI()
                            .clear()
                            .catch((error: Error) => {
                                this._notifications.add({
                                    caption: 'Error',
                                    message: `Fail to drop recent filters history due error: ${error.message}`,
                                });
                            });
                },
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _self: ElementRef,
        private _notifications: NotificationsService,
    ) {
        this._onGlobalKeyUp = this._onGlobalKeyUp.bind(this);
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._providers.destroy();
        window.removeEventListener('keyup', this._onGlobalKeyUp);
        if (this._session !== undefined) {
            this._session.getSessionSearch().getChartsAPI().selectBySource(undefined);
        }
    }

    public ngAfterViewInit() {
        this._providers.add(EProviders.filters, new ProviderFilters());
        this._providers.add(EProviders.charts, new ProviderCharts());
        this._providers.add(EProviders.ranges, new ProviderRanges());
        this._providers.add(EProviders.disabled, new ProviderDisabled());
        this._ng_providers = this._providers.list();
        this._subscriptions.select = this._providers
            .getObservable()
            .select.subscribe(this._onSingleSelection.bind(this));
        this._subscriptions.context = this._providers
            .getObservable()
            .context.subscribe(this._onContextMenu.bind(this));
        this._subscriptions.change = this._providers
            .getObservable()
            .change.subscribe(this._onChange.bind(this));
        this._subscriptions.onSessionChange =
            EventsSessionService.getObservable().onSessionChange.subscribe(
                this._onSessionChange.bind(this),
            );
        window.addEventListener('keyup', this._onGlobalKeyUp);
        this._onSessionChange(undefined);
    }

    public _ng_onPanelClick() {
        this._forceUpdate();
    }

    public _ng_onMouseOver() {
        SearchManagerService.onMouseOverGlobal();
    }

    private _onContextMenu(event: IContextMenuEvent) {
        ContextMenuService.show({
            items: event.items,
            x: event.event.pageX,
            y: event.event.pageY,
        });
        event.event.stopImmediatePropagation();
        event.event.preventDefault();
    }

    private _onGlobalKeyUp(event: KeyboardEvent) {
        if (!this._focused) {
            return;
        }
        switch (event.code) {
            case 'ArrowUp':
                this._providers.select().prev();
                break;
            case 'ArrowDown':
                this._providers.select().next();
                break;
            case 'Enter':
                this._providers.edit().in();
                break;
        }
        event.stopImmediatePropagation();
        event.preventDefault();
        return false;
    }

    private _onSessionChange(session: Session | undefined) {
        if (session === undefined) {
            session = TabsSessionsService.getActive();
        }
        if (session === undefined) {
            this._ng_selected = undefined;
            this._forceUpdate();
        } else {
            this._session = session;
            const single = this._providers.select().single(this._session.getGuid());
            this._ng_selected = single === undefined ? undefined : single.provider;
        }
    }

    private _onSingleSelection(event: ISelectEvent | undefined) {
        if (event === undefined && this._ng_selected === undefined) {
            return;
        }
        if (event === undefined) {
            this._ng_selected = undefined;
        } else {
            this._ng_selected = event.provider;
        }
        this._forceUpdate();
    }

    private _onChange() {
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
