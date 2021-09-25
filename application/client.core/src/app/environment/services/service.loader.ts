import { setSharedServices } from './shared.services.sidebar';

import ServiceElectronIpc, { IPC } from './service.electron.ipc';
import PluginsIPCService from './service.plugins.ipc';
import PluginsService from './service.plugins';
import SourcesService from './service.sources';
import FileOptionsService from './service.file.options';
import FilterOpenerService from './service.filter.opener';
import ToolbarSessionsService from './service.sessions.toolbar';
import SidebarSessionsService from './service.sessions.sidebar';
import TabsSessionsService from './service.sessions.tabs';
import TabsCustomService from './service.custom.tabs';
import FileOpenerService from './service.file.opener';
import MergeFilesService from './service.file.merge';
import ConcatFilesService from './service.file.concat';
import HotkeysService from './service.hotkeys';
import ConnectionsService from './service.connections';
import LogsService from './service.logs';
import SettingsService from './service.settings';
import SettingsDefaultsService from './settings/settings.defaults';
import TabSelectionParserService from './tabs/service.tab.selection.parser';
import ReleaseNotesService from './service.release.notes';
import RenderStateService from './service.render.state';
import ElectronEnvService from './service.electron.env';

import * as Defaults from '../states/state.default';
import * as Toolkit from 'chipmunk.client.toolkit';

const InitializeStages = [
    // Stage #0
    [ServiceElectronIpc],
    // Stage #1
    [ElectronEnvService],
    // Stage #2
    [LogsService],
    // Stage #3
    [SettingsService],
    // Stage #4
    [SettingsDefaultsService],
    // Stage #5
    [PluginsService, SourcesService],
    // Stage #6
    [PluginsIPCService],
    // Stage #7
    [
        TabsSessionsService,
        TabsCustomService,
        ToolbarSessionsService,
        SidebarSessionsService,
        FileOptionsService,
        FilterOpenerService,
        FileOpenerService,
        MergeFilesService,
        ConcatFilesService,
        HotkeysService,
        ConnectionsService,
        RenderStateService,
    ],
    // Stage #8
    [TabSelectionParserService, ReleaseNotesService],
];

// TODO: Destroy method, even dummy

export class LoaderService {
    private _logger: Toolkit.Logger = new Toolkit.Logger('LoaderService');
    private _subscription!: Toolkit.Subscription;
    private _resolver!: () => any | undefined;
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
                // Make post init operations
                this._postInit().then(() => {
                    // Request state of host
                    ServiceElectronIpc.request<IPC.HostState>(new IPC.HostState({}))
                        .then((response) => {
                            if (response.state === IPC.EHostState.ready) {
                                return resolve();
                            }
                            // Subscribe to state event
                            this._subscription = ServiceElectronIpc.subscribe(
                                IPC.HostState,
                                this._onHostStateChange.bind(this),
                            );
                            this._resolver = resolve;
                        })
                        .catch((requestError: Error) => {
                            this._logger.error(
                                `Fail to request HostState due error: ${requestError.message}`,
                            );
                        });
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
        Promise.all(tasks)
            .then(() => {
                this._logger.env(`Application initialization: stage #${stage + 1}: OK`);
                this._init(stage + 1, callback);
            })
            .catch((error: Error) => {
                this._logger.env(`Fail to initialize application dure error: ${error.message}`);
                callback(error);
            });
    }

    private _onHostStateChange(message: IPC.HostState) {
        if (this._resolver === undefined) {
            return;
        }
        if (message.state === IPC.EHostState.ready) {
            this._subscription.destroy();
            this._resolver();
        }
    }

    private _postInit(): Promise<void> {
        return new Promise((resolve) => {
            // Set defaults views
            TabsSessionsService.setDefaultViews(Defaults.getDefaultViews());
            // Set services, which should be shared with sidebar apps
            setSharedServices({
                FileOpenerService: FileOpenerService,
                MergeFilesService: MergeFilesService,
                ConcatFilesService: ConcatFilesService,
            });
            resolve();
        });
    }
}

export default new LoaderService();
