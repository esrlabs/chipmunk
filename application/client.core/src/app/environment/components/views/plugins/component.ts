import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef, ViewEncapsulation } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { IComponentDesc } from 'chipmunk-client-material';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { ControllerSessionScope } from '../../../controller/controller.session.tab.scope';
import { FiltersStorage, FilterRequest } from '../../../controller/controller.session.tab.search.filters.storage';
import { ChartsStorage, ChartRequest } from '../../../controller/controller.session.tab.search.charts.storage';
import { NotificationsService } from '../../../services.injectable/injectable.service.notifications';
import { rankedNumberAsString } from '../../../controller/helpers/ranks';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { MatInput, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material';
import ContextMenuService, { IMenuItem } from '../../../services/standalone/service.contextmenu';

import TabsSessionsService from '../../../services/service.sessions.tabs';
import HotkeysService from '../../../services/service.hotkeys';
import SidebarSessionsService from '../../../services/service.sessions.sidebar';
import LayoutStateService from '../../../services/standalone/service.layout.state';

import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-plugins',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    encapsulation: ViewEncapsulation.None
})

export class ViewPluginsComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @Input() public injectionIntoTitleBar: Subject<IComponentDesc>;
    @Input() public onBeforeTabRemove: Subject<void>;
    @Input() public setActiveTab: (guid: string) => void;
    @Input() public getDefaultsTabGuids: () => { charts: string };
    @Input() public onTitleContextMenu: Observable<MouseEvent>;

    public _ng_searchInputCtrl = new FormControl();
    public _ng_recent: Observable<string[]>;
    public _ng_flags: {
        casesensitive: boolean,
        wholeword: boolean,
        regexp: boolean,
    } = {
        casesensitive: false,
        wholeword: false,
        regexp: true,
    };

    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewSearchComponent');
    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = { };
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _notifications: NotificationsService) {
    }

    public ngAfterViewInit() {

    }

    public ngAfterContentInit() {

    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._destroyed = true;
    }

    public _ng_getViewDelimiterPosition() {
        return '50%';
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
