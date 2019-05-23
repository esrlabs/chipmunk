import ServiceElectronIpc, { IPCMessages } from './service.electron.ipc';
import PluginsIPCService from './service.plugins.ipc';
import PluginsService from './service.plugins';
import SourcesService from './service.sources';
import FileOptionsService from './service.file.options';
import HorizontalSidebarSessionsService from './service.sessions.sidebar.horizontal';
import TabsSessionsService from './service.sessions.tabs';

import * as Toolkit from 'logviewer.client.toolkit';

const InitializeStages = [
    // Stage #1
    [ServiceElectronIpc],
    // Stage #2
    [PluginsService, SourcesService],
    // Stage #3
    [PluginsIPCService],
    // Stage #4
    [TabsSessionsService, HorizontalSidebarSessionsService, FileOptionsService],
];

// TODO: Destroy method, even dummy

export class LoaderService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('PluginsLoader');
    private _subscription: Toolkit.Subscription | undefined;
    private _resolver: () => any | undefined;
    /**
     * Initialization of application
     * Will start application in case of success of initialization
     * @returns void
     */
    public init(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._init(0, (error?: Error) => {
                if (error instanceof Error) {
                    return reject(error);
                }
                // Request state of host
                ServiceElectronIpc.request(new IPCMessages.HostState({})).then((response: IPCMessages.HostState) => {
                    if (response.state === IPCMessages.EHostState.ready) {
                        return resolve();
                    }
                    // Subscribe to state event
                    this._subscription = ServiceElectronIpc.subscribe(IPCMessages.HostState, this._onHostStateChange.bind(this));
                    this._resolver = resolve;
                }).catch((requestError: Error) => {
                    this._logger.error(`Fail to request HostState due error: ${requestError.message}`);
                });
            });
        });
    }

    private _init(stage: number = 0, callback: (error?: Error) => any): void {
        if (InitializeStages.length <= stage) {
            this._logger.env(`Application is initialized`);
            typeof callback === 'function' && callback();
            return;
        }
        this._logger.env(`Application initialization: stage #${stage + 1}: starting...`);
        const services: any[] = InitializeStages[stage];
        const tasks: Array<Promise<any>> = services.map((ref: any) => {
            this._logger.env(`Init: ${ref.getName()}`);
            return ref.init();
        });
        if (tasks.length === 0) {
            return this._init(stage + 1, callback);
        }
        Promise.all(tasks).then(() => {
            this._logger.env(`Application initialization: stage #${stage + 1}: OK`);
            this._init(stage + 1, callback);
        }).catch((error: Error) => {
            this._logger.env(`Fail to initialize application dure error: ${error.message}`);
            callback(error);
        });
    }

    private _onHostStateChange(message: IPCMessages.HostState) {
        if (this._resolver === undefined) {
            return;
        }
        if (message.state === IPCMessages.EHostState.ready) {
            this._subscription.destroy();
            this._resolver();
        }
    }

}

export default (new LoaderService());
