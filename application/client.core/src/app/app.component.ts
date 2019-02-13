import { AfterViewInit, Component, Compiler, Injector, ViewChild, ViewContainerRef } from '@angular/core';
import { NotificationsService } from './environment/services/service.notifications';
import ServiceElectronIpc from 'logviewer.client.electron.ipc';
import { IPCMessages, Subscription } from 'logviewer.client.electron.ipc';
import { PluginsService } from './environment/services/service.plugins';
import * as Tools from './environment/tools/index';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.less']
})

export class AppComponent implements AfterViewInit {

    private _logger: Tools.Logger = new Tools.Logger('PluginsService');
    private _pluginsService: PluginsService = new PluginsService(this._compiler, this._injector);

    constructor(
      private _compiler: Compiler,
      private _injector: Injector,
      private _notifications: NotificationsService) { }

    ngAfterViewInit() {
        // Send notification to host
        ServiceElectronIpc.send(new IPCMessages.RenderState({
            state: IPCMessages.ERenderState.ready
        })).catch((sendingError: Error) => {
            this._logger.error(`Fail to send "IPCMessages.RenderState" message to host due error: ${sendingError.message}`);

        });
    }

}
