import { AfterViewInit, Component, Compiler, Injector, ChangeDetectorRef } from '@angular/core';
import { NotificationsService } from './environment/services.injectable/injectable.service.notifications';
import ServiceElectronIpc from './environment/services/service.electron.ipc';
import { IPCMessages, Subscription } from './environment/services/service.electron.ipc';
import PluginsService from './environment/services/service.plugins';
import LoaderService from './environment/services/service.loader';
import * as Toolkit from 'logviewer.client.toolkit';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.less']
})

export class AppComponent implements AfterViewInit {

    private _logger: Toolkit.Logger = new Toolkit.Logger('AppComponent');
    private _ready: boolean = false;

    constructor(
        private _cdRef: ChangeDetectorRef,
        private _compiler: Compiler,
        private _injector: Injector,
        private _notifications: NotificationsService) {
        PluginsService.defineCompilerAndInjector(_compiler, _injector);
    }

    ngAfterViewInit() {
        LoaderService.init().then(() => {
            // Subscribe to plugins load event
            PluginsService.subscribe(PluginsService.Events.pluginsLoaded, () => {
                PluginsService.unsubscribeAll();
                this._ready = true;
                this._cdRef.detectChanges();
            });
            // Send notification to host
            ServiceElectronIpc.send(new IPCMessages.RenderState({
                state: IPCMessages.ERenderState.ready
            })).catch((sendingError: Error) => {
                this._logger.error(`Fail to send "IPCMessages.RenderState" message to host due error: ${sendingError.message}`);
            });
        });
    }

}
