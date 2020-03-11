import { Component, OnDestroy, ChangeDetectorRef, Input, AfterContentInit, AfterViewInit } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonInterfaces } from '../../../interfaces/interface.common';
import { FormControl } from '@angular/forms';

import * as Toolkit from 'chipmunk.client.toolkit';

import ContextMenuService, { IMenu, IMenuItem } from '../../../services/standalone/service.contextmenu';
import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';
import PluginsService from '../../../services/service.plugins';

@Component({
    selector: 'app-sidebar-app-plugins',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppPluginsComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppPluginsComponent');

    public _ng_installed: CommonInterfaces.Plugins.IPlugin[] = [];
    public _ng_searchInputCtrl = new FormControl();

    constructor(private _cdRef: ChangeDetectorRef,
                private _sanitizer: DomSanitizer) {
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngAfterContentInit() {
        PluginsService.getInstalledPluginsInfo().then((plugins: CommonInterfaces.Plugins.IPlugin[]) => {
            this._ng_installed = plugins;
        }).catch((error: Error) => {
            this._logger.warn(`Fail to get list of installed plugins due error: ${error.message}`);
            this._ng_installed = [];
        });
    }

    public ngAfterViewInit() {

    }

}
