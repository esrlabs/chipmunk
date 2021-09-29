declare var System: any;

import * as AngularCore from '@angular/core';
import * as Toolkit from 'chipmunk.client.toolkit';

import { Subscription } from 'rxjs';
import { Compiler, Injector } from '@angular/core';
import { IPC } from './service.electron.ipc';
import { IService } from '../interfaces/interface.service';
import { ControllerPluginGate } from '../controller/controller.plugin.gate';
import { IAPI } from 'chipmunk.client.toolkit';
import { getAvailablePluginModules } from '../controller/controller.plugin.deps';
import ElectronIpcService from './service.electron.ipc';
import PluginsIPCService from './service.plugins.ipc';
import LogsService from './service.logs';
import OutputParsersService from './standalone/service.output.parsers';
import SelectionParsersService from './standalone/service.selection.parsers';
import ControllerPluginIPC from '../controller/controller.plugin.ipc';
import ControllerPluginsManager from '../controller/controller.plugins.manager';

export type TRowParser = (str: string) => string;

export interface IPluginControllers {
    sessions: Toolkit.ControllerSessionsEvents;
}

export interface IPluginData {
    name: string; // Name of plugin
    token: string; // Plugin token
    exports: Toolkit.IPluginExports; // Exports of plugin
    ipc: ControllerPluginIPC; // Related to plugin IPC
    controllers: IPluginControllers; // Collection of controllers to plugin listents
    id: number; // ID of plugin
    displayName: string; // Displaied name of plugin (for example title of tab)
    factories: { [key: string]: any };
    mwcf?: AngularCore.ModuleWithComponentFactories<any>;
}

const CPluginEvents = {
    onSessionChange: 'onSessionChange',
    onSessionOpen: 'onSessionOpen',
    onSessionClose: 'onSessionClose',
};

export class PluginsService extends Toolkit.Emitter implements IService {
    public Events = {
        pluginsLoaded: 'pluginsLoaded',
        onTaskBarPlugin: 'onTaskBarPlugin',
    };

    private _logger: Toolkit.Logger = new Toolkit.Logger('PluginsService');
    private _compiler!: Compiler;
    private _injector!: Injector;
    private _plugins: Map<string, IPluginData> = new Map();
    private _subscriptions: { [key: string]: Subscription | Toolkit.Subscription } = {};
    private _idsCache: { [key: number]: IPluginData } = {};
    private _factories: AngularCore.ComponentFactory<any>[] = [];
    private _getPluginAPIByID?: (pluginId: number) => IAPI;
    private _manager: ControllerPluginsManager;
    private _jitCompiler: any;

    constructor() {
        super();
        this._manager = new ControllerPluginsManager();
        this._subscriptions.mountPlugin = ElectronIpcService.subscribe(
            IPC.RenderMountPlugin,
            this._ipc_onRenderMountPlugin.bind(this),
        );
    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            System.import('./compiler.umd.js')
                .then((mod: any) => {
                    this._jitCompiler = mod;
                    this._logger.debug(`Angular JIT compiler is loaded`);
                    resolve();
                })
                .catch((err: Error) => {
                    this._logger.warn(
                        `Fail to load Angular JIT compiler. Angular based plugins would not be available. Error: ${err.message}`,
                    );
                    resolve();
                });
        });
    }

    public getName(): string {
        return 'PluginsService';
    }

    public defineCompilerAndInjector(compiler: Compiler, injector: Injector) {
        this._compiler = compiler;
        this._injector = injector;
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._manager.destroy();
    }

    public getPlugin(name: string): IPluginData | undefined {
        return this._plugins.get(name);
    }

    public getPluginById(id: number): IPluginData | undefined {
        if (this._idsCache[id] !== undefined) {
            return this._idsCache[id];
        }
        let name: string | undefined;
        this._plugins.forEach((plugin: IPluginData, pluginName: string) => {
            if (plugin.id === id) {
                name = pluginName;
            }
        });
        if (name === undefined) {
            this._logger.warn(`Fail to find plugin by ID: ${id}`);
            return undefined;
        }
        let plugin = this._plugins.get(name);
        if (plugin !== undefined) {
            this._idsCache[id] = plugin;
        }
        return this._idsCache[id];
    }

    public getPluginFactory(
        id: number,
        selector: string,
    ): AngularCore.ComponentFactory<any> | undefined {
        const plugin: IPluginData | undefined = this.getPluginById(id);
        if (plugin === undefined) {
            return undefined;
        }
        if (plugin.mwcf === undefined) {
            return;
        }
        return plugin.mwcf.componentFactories.find((e) => e.selector === selector);
    }

    public fire(): {
        onSessionChange: (guid: string) => void;
        onSessionOpen: (guid: string) => void;
        onSessionClose: (guid: string) => void;
    } {
        return {
            onSessionChange: this._fire.bind(this, CPluginEvents.onSessionChange),
            onSessionOpen: this._fire.bind(this, CPluginEvents.onSessionOpen),
            onSessionClose: this._fire.bind(this, CPluginEvents.onSessionClose),
        };
    }

    public getStoredFactoryBySelector(
        selector: string,
    ): AngularCore.ComponentFactory<any> | undefined {
        return this._factories.find((e) => e.selector === selector);
    }

    public getStoredFactoryByName(name: string): AngularCore.ComponentFactory<any> | undefined {
        return this._factories.find((e) => e.componentType.name === name);
    }

    public setPluginAPIGetter(getter: (pluginId: number) => IAPI) {
        this._getPluginAPIByID = getter;
    }

    public getAvailablePlugins(): IPluginData[] {
        return Array.from(this._plugins.values());
    }

    public getManager(): ControllerPluginsManager {
        return this._manager;
    }

    private _fire(event: string, ...args: any) {
        this._plugins.forEach((plugin: IPluginData) => {
            const emitter = plugin.controllers.sessions.emit();
            if (typeof (emitter as any)[event] !== 'function') {
                return;
            } else {
            }
            (emitter as any)[event](...args);
        });
    }

    private _loadAndInit(
        name: string,
        displayName: string,
        token: string,
        id: number,
        location: string,
    ): Promise<IPluginData> {
        return new Promise((resolve, reject) => {
            Toolkit.sequences([
                // Step 1. Delivery sources of module
                this._loadAndInit_FetchPlugin.bind(this, name, token, id, location), // Returns { string } - code of module
                // Steps 2 - 3. Prepare environment and init code of module
                this._loadAndInit_InitPlugin.bind(this, name, token, id, location), // Returns { [key: string]: any } - all exports of module
                // Steps 4 - 6. Compile code as Angular module, discover shares of module
                this._loadAndInit_CompilePlugin.bind(this, name, token, id, displayName), // Returns { IPluginData } - plugin data
                // Steps 7. Setup access to API for plugin's service (if it exists)
                this._loadAndInit_SetupPluginService.bind(this, name, token, id, location), // Returns { IPluginData } - plugin data
            ])
                .then((pluginData: IPluginData) => {
                    resolve(pluginData);
                })
                .catch((error: Error) => {
                    reject(error);
                });
        });
    }

    private _loadAndInit_FetchPlugin(
        name: string,
        token: string,
        id: number,
        location: string,
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            // Step 1. Delivery sources
            fetch(location)
                .then((response: Response) => {
                    response
                        .text()
                        .then((source: string) => {
                            resolve(source);
                        })
                        .catch((responseError: Error) => {
                            reject(
                                new Error(
                                    this._logger.error(
                                        `Response of plugin "${name}" wasn't parsed correctly due error: ${responseError.message}`,
                                    ),
                                ),
                            );
                        });
                })
                .catch((fetchError: Error) => {
                    reject(
                        new Error(
                            this._logger.error(
                                `Plugin "${name}" wasn't loaded due error: ${fetchError.message}`,
                            ),
                        ),
                    );
                });
        });
    }

    private _loadAndInit_InitPlugin(
        name: string,
        token: string,
        id: number,
        location: string,
        code: string,
    ): Promise<{ [key: string]: any }> {
        return new Promise((resolve, reject) => {
            // Step 2. Prepare environment for plugin initialization
            this._logger.env(`Sources of plugin "${name}" was fetch correctly.`);
            const modules: any = getAvailablePluginModules();
            const require = (module: string) => modules[module]; // shim 'require'
            let exports: Toolkit.IPluginExports = {};
            // Create gate in global scope
            const gate: ControllerPluginGate = new ControllerPluginGate(modules, require);
            (window as any).chipmunk = gate;
            (window as any).logviewer = gate; // Back-compatibility
            if ((window as any).global === undefined) {
                (window as any).global = {};
            }
            if ((window as any).global.ng === undefined && this._jitCompiler !== undefined) {
                (window as any).global.ng = {
                    ɵcompilerFacade: this._jitCompiler.default.ɵcompilerFacade,
                    compiler: this._jitCompiler.default.compiler,
                };
            }
            if (!LogsService.isProduction()) {
                code = `console.log('Reference to code of plugin "${name.replace(
                    /'/gi,
                    '"',
                )}"');\n${code}`;
            }
            // Step 3. Execute code of plugin to initialize
            try {
                // tslint:disable-next-line:no-eval
                eval(code);
            } catch (executeError) {
                return reject(
                    new Error(
                        this._logger.error(
                            `Fail to execute plugin "${name}" due error: ${
                                executeError instanceof Error ? executeError.message : executeError
                            }`,
                        ),
                    ),
                );
            }
            // Get exports (if it was injected)
            if (Object.keys(exports).length === 0) {
                exports = gate.getPluginExports();
            }
            // Remove gate from global scope
            delete (window as any).logviewer;
            // Done
            resolve(exports);
        });
    }

    private _loadAndInit_CompilePlugin(
        name: string,
        token: string,
        id: number,
        displayName: string,
        exports: Toolkit.IPluginExports,
    ): Promise<IPluginData> {
        return new Promise((resolve, reject) => {
            const ngModule: AngularCore.Type<any> | undefined = this._getNgModule(exports);
            if (ngModule === undefined) {
                // This is not angular module. Store plugin
                const pluginData: IPluginData = {
                    name: name,
                    displayName: displayName,
                    token: token,
                    exports: exports,
                    ipc: new ControllerPluginIPC(name, token),
                    controllers: {
                        sessions: new Toolkit.ControllerSessionsEvents(),
                    },
                    id: id,
                    factories: {},
                };
                // Setup common parsers
                OutputParsersService.setParsers(exports, id);
                // Setup selection parsers
                SelectionParsersService.setParsers(exports, id);
                resolve(pluginData);
            } else {
                // This is Angular module
                this._compiler
                    .compileModuleAndAllComponentsAsync<any>(ngModule)
                    .then((mwcf: AngularCore.ModuleWithComponentFactories<any>) => {
                        // Step 5. Create plugin module
                        try {
                            const module = mwcf.ngModuleFactory.create(this._injector);
                            if (!(module.instance instanceof ngModule)) {
                                return reject(
                                    new Error(
                                        this._logger.error(
                                            `Fail to compile main module of plugin "${name}".`,
                                        ),
                                    ),
                                );
                            }
                            // Store plugin data
                            const pluginData: IPluginData = {
                                name: name,
                                displayName: displayName,
                                token: token,
                                exports: exports,
                                ipc: new ControllerPluginIPC(name, token),
                                controllers: {
                                    sessions: new Toolkit.ControllerSessionsEvents(),
                                },
                                id: id,
                                factories: {},
                                mwcf: mwcf,
                            };
                            // Setup parsers
                            OutputParsersService.setParsers(exports, id, mwcf);
                            // Setup selection parsers
                            SelectionParsersService.setParsers(exports, id);
                            // Store factories of plugin
                            const selectors: string[] = Object.keys(Toolkit.EViewsTypes).map(
                                (key: string) => {
                                    return (Toolkit.EViewsTypes as any)[key];
                                },
                            );
                            // Init all factories
                            this._factories.push(
                                ...mwcf.componentFactories.filter(
                                    (factory: AngularCore.ComponentFactory<any>) => {
                                        if (selectors.indexOf(factory.selector) !== -1) {
                                            return false;
                                        }
                                        if (
                                            factory.selector.indexOf('lib-primitive') !== -1 ||
                                            factory.selector.indexOf('lib-complex') !== -1 ||
                                            factory.selector.indexOf('lib-containers') !== -1
                                        ) {
                                            return false;
                                        }
                                        return !this._isComponentFactoryStored(factory);
                                    },
                                ),
                            );
                            // Check views
                            Object.keys(Toolkit.EViewsTypes).forEach((alias: string) => {
                                const selector: string = (Toolkit.EViewsTypes as any)[alias];
                                const componentFactory = mwcf.componentFactories.find(
                                    (e) => e.selector === selector,
                                );
                                if (componentFactory) {
                                    pluginData.factories[selector] = componentFactory;
                                }
                            });
                            resolve(pluginData);
                        } catch (moduleCompileError) {
                            return reject(
                                new Error(
                                    this._logger.error(
                                        `Fail to compile main module of plugin "${name}" due error: ${
                                            moduleCompileError instanceof Error
                                                ? moduleCompileError.message
                                                : moduleCompileError
                                        }.`,
                                    ),
                                ),
                            );
                        }
                    })
                    .catch((compileError: Error) => {
                        reject(
                            new Error(
                                this._logger.error(
                                    `Fail to compile plugin "${name}" due error: ${compileError.message}`,
                                ),
                            ),
                        );
                    });
            }
        });
    }

    private _loadAndInit_SetupPluginService(
        name: string,
        token: string,
        id: number,
        location: string,
        pluginData: IPluginData,
    ): Promise<IPluginData> {
        return new Promise((resolve) => {
            const service: Toolkit.PluginService | undefined = this._getPluginService(
                pluginData.exports,
            );
            if (service === undefined) {
                return resolve(pluginData);
            }
            // Setup API of plugin
            service.setAPIGetter(this._getPluginAPI.bind(this, id));
            // Finish
            resolve(pluginData);
        });
    }

    private _getPluginAPI(id: number): Toolkit.IAPI | undefined {
        if (this._getPluginAPIByID === undefined) {
            return undefined;
        }
        return this._getPluginAPIByID(id);
    }

    private _getNgModule(exports: Toolkit.IPluginExports): AngularCore.Type<any> | undefined {
        let module: Toolkit.PluginNgModule | undefined;
        Object.keys(exports).forEach((key: string) => {
            if (module === undefined && Toolkit.PluginNgModule.isInstance(exports[key])) {
                module = (exports as any)[key] as Toolkit.PluginNgModule;
            }
        });
        return module as any;
    }

    private _getPluginService(exports: Toolkit.IPluginExports): Toolkit.PluginService | undefined {
        let service: Toolkit.PluginService | undefined;
        Object.keys(exports).forEach((key: string) => {
            if (service === undefined && Toolkit.PluginService.isInstance(exports[key])) {
                service = exports[key] as Toolkit.PluginService;
            }
        });
        return service;
    }

    private _inspectComponentsOfPlugins() {
        this._plugins.forEach((plugin: IPluginData) => {
            if (plugin.factories[Toolkit.EViewsTypes.tasksBar] !== undefined) {
                this.emit(
                    this.Events.onTaskBarPlugin,
                    plugin.id,
                    plugin.factories[Toolkit.EViewsTypes.tasksBar],
                    plugin.ipc,
                );
            }
        });
    }

    private _ipc_onRenderMountPlugin(event: IPC.RenderMountPlugin): void {
        let left: number = event.plugins.length;
        const done = () => {
            left -= 1;
            if (left === 0) {
                setTimeout(() => {
                    // Emit event out of scope promise to avoid catch section in case of exception
                    this.emit(this.Events.pluginsLoaded);
                    this._inspectComponentsOfPlugins();
                }, 50);
            }
        };
        if (event.plugins.length === 0) {
            this.emit(this.Events.pluginsLoaded);
            return;
        }
        event.plugins.forEach((pluginInfo: IPC.IRenderMountPluginInfo) => {
            this._logger.env(
                `Information about plugin "${pluginInfo.name}" has been gotten. Starting loading & initialization.`,
            );
            this._loadAndInit(
                pluginInfo.name,
                pluginInfo.displayName,
                pluginInfo.token,
                pluginInfo.id,
                pluginInfo.location,
            )
                .then((pluginData: IPluginData) => {
                    // Store IPC
                    PluginsIPCService.addPlugin(pluginInfo.token, pluginData.ipc);
                    // Save plugin
                    this._plugins.set(pluginData.name, pluginData);
                    this._logger.env(`Plugin "${pluginInfo.name}" is successfully mount.`);
                    done();
                })
                .catch((loadError: Error) => {
                    this._logger.error(
                        `Fail to load and initialize plugin "${pluginInfo.name}" due error: ${loadError.message}`,
                    );
                    done();
                });
        });
    }

    private _isComponentFactoryStored(factory: AngularCore.ComponentFactory<any>): boolean {
        return this._factories.find((e) => e.selector === factory.selector) !== undefined;
    }
}

export default new PluginsService();
