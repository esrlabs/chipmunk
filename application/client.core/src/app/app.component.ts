import {
    AfterViewInit,
    Component,
    Compiler,
    Injector,
    ChangeDetectorRef,
    OnDestroy,
} from '@angular/core';
import { NotificationsService } from './environment/services.injectable/injectable.service.notifications';
import { Subscription } from 'rxjs';
import { CDefaultTabsGuids } from './environment/services/service.sessions.toolbar';

import ServiceElectronIpc from './environment/services/service.electron.ipc';
import PluginsService from './environment/services/service.plugins';
import LoaderService from './environment/services/service.loader';
import ToolbarSessionsService from './environment/services/service.sessions.toolbar';
import RenderStateService from './environment/services/service.render.state';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.less'],
})
export class AppComponent implements AfterViewInit, OnDestroy {
    public _ng_ready: boolean = false;

    private _logger: Toolkit.Logger = new Toolkit.Logger('AppComponent');
    private _subscriptions: { [key: string]: Subscription } = {};

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _compiler: Compiler,
        private _injector: Injector,
        private _notifications: NotificationsService,
    ) {
        PluginsService.defineCompilerAndInjector(_compiler, _injector);
    }

    ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    ngAfterViewInit() {
        LoaderService.init().then(() => {
            // Subscribe to plugins load event
            PluginsService.subscribe(PluginsService.Events.pluginsLoaded, () => {
                PluginsService.unsubscribeAll();
                this._ng_ready = true;
                this._cdRef.detectChanges();
            });
            // Subscribe to notifications
            this._subscriptions.onNewNotification = this._notifications
                .getObservable()
                .new.subscribe(() => {
                    if (!ToolbarSessionsService.has(CDefaultTabsGuids.notification)) {
                        ToolbarSessionsService.addByGuid(CDefaultTabsGuids.notification);
                    }
                });
            RenderStateService.state().inited();
        });
    }
}
