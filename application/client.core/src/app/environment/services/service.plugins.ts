import { Compiler, Injector } from '@angular/core';
import ServiceElectronIpc from 'logviewer.client.electron.ipc';
import { IPCMessages, Subscription } from 'logviewer.client.electron.ipc';
import * as AngularCore from '@angular/core';
import * as AngularCommon from '@angular/common';
import * as Tools from '../tools/index';

import { TabsService, TabsOptions, ETabsListDirection, DockingComponent, DockDef, DocksService } from 'logviewer-client-complex';


const PluginDefaultViewsComponents = {
    view: 'lib-view',
    state: 'lib-state',
    static: 'lib-static'
};

type TPluginModule = any;

export interface IPluginData {
    module: TPluginModule;  // Instance of plugin module
    factories: {
        view?: any;         // Component of view
        state?: any;        // Component of state app (to mount into state bar)
        static?: any;       // Component of static app (to mount into secondory area as tab)
    };
}

export class PluginsService {

    private _logger: Tools.Logger = new Tools.Logger('PluginsService');
    private _compiler: Compiler;
    private _injector: Injector;
    private _subscriptions: { [key: string]: Subscription | undefined } = {
        mountPlugin: undefined,
    };

    constructor(compiler: Compiler, injector: Injector) {
        this._compiler = compiler;
        this._injector = injector;
        this._ipc_onRenderMountPlugin = this._ipc_onRenderMountPlugin.bind(this);
        ServiceElectronIpc.subscribe(IPCMessages.RenderMountPlugin, this._ipc_onRenderMountPlugin).then((subscription: Subscription) => {
            this._subscriptions.mountPlugin = subscription;
        }).catch((subscribeError: Error) => {
            this._logger.error(`Fail to subscribe to event "IPCMessages.PluginMount" due error: ${subscribeError.message}`);
            this._subscriptions.state = undefined;
        });
    }

    public destroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].destroy();
        });
    }

    private _loadAndInit(name: string, location: string): Promise<IPluginData> {
        return new Promise((resolve, reject) => {
            // Step 1. Delivery sources
            fetch(location).then((response: Response) => {
                response.text().then((source: string) => {
                    // Step 2. Prepare environment for plugin initialization
                    this._logger.env(`Sources of plugin "${name}" was fetch correctly.`);
                    const exports: any = {};
                    const modules: any = {
                        '@angular/core': AngularCore,
                        '@angular/common': AngularCommon
                    };
                    const require = (module) => modules[module]; // shim 'require'
                    // Step 3. Execute code of plugin to initialize
                    try {
                        // tslint:disable-next-line:no-eval
                        eval(source);
                    } catch (executeError) {
                        return reject(new Error(this._logger.error(`Fail to execute plugin "${name}" due error: ${executeError.message}`)));
                    }
                    // Step 4. Check plugin module
                    if (!exports['PluginModule']) {
                        return reject(new Error(this._logger.error(`Fail to compile plugin "${name}" because module "PluginModule" wasn't found.`)));
                    }
                    // Step 5. Compile
                    this._compiler.compileModuleAndAllComponentsAsync<any>(exports['PluginModule']).then((mwcf) => {
                        // Ok. From here we have access to plugin components. Also all components should be already initialized
                        // Step 6. Create plugin module
                        try {
                            const module = mwcf.ngModuleFactory.create(this._injector);
                            if (!(module.instance instanceof exports['PluginModule'])) {
                                return reject(new Error(this._logger.error(`Fail to compile main module of plugin "${name}".`)));
                            }
                            // Step 7. Search views of apps
                            const pluginData: IPluginData = {
                                module: module,
                                factories: {}
                            };
                            Object.keys(PluginDefaultViewsComponents).forEach((alias: string) => {
                                const selector: string = PluginDefaultViewsComponents[alias];
                                const componentFactory = mwcf.componentFactories.find(e => e.selector === selector);
                                if (componentFactory) {
                                    pluginData.factories[alias] = componentFactory;
                                }
                            });
                            resolve(pluginData);
                        } catch (moduleCompileError) {
                            return reject(new Error(this._logger.error(`Fail to compile main module of plugin "${name}" due error: ${moduleCompileError.message}.`)));
                        }
                    }).catch((compileError: Error) => {
                        reject(new Error(this._logger.error(`Fail to compile plugin "${name}" due error: ${compileError.message}`)));
                    });
                }).catch((responseError: Error) => {
                    reject(new Error(this._logger.error(`Response of plugin "${name}" wasn't parsed correctly due error: ${responseError.message}`)));
                });
            }).catch((fetchError: Error) => {
                reject(new Error(this._logger.error(`Plugin "${name}" wasn't loaded due error: ${fetchError.message}`)));
            });
        });
    }

    private _deliveryApps(pluginData: IPluginData): Promise<void> {
        return new Promise((resolve, reject) => {
            (window as any).__tabs.add({
                name: 'Tab plugin',
                active: true,
                content: {
                    factory: DockingComponent,
                    inputs: {
                        service: new DocksService('plugin', new DockDef.Container({
                            a: new DockDef.Dock({ caption: 'Dock plugin', component: { factory: pluginData.factories.view, resolved: true, inputs: { title: 'test '}} })
                        }))
                    }
                }
            });
            resolve();
        });
    }

    private _ipc_onRenderMountPlugin(event: IPCMessages.RenderMountPlugin): void {
        this._logger.env(`Information about plugin "${event.name}" has been gotten. Starting loading & initialization.`);
        this._loadAndInit(event.name, event.location).then((pluginData: IPluginData) => {
            // Delivery applications of plugin into main application
            this._deliveryApps(pluginData).then(() => {
                this._logger.error(`Plugin "${event.name}" is successfully mount.`);
            }).catch((deliveryError: Error) => {
                this._logger.error(`Fail to delivery applications of plugin "${event.name}" due error: ${deliveryError.message}`);
            });
        }).catch((loadError: Error) => {
            this._logger.error(`Fail to load and initialize plugin "${event.name}" due error: ${loadError.message}`);
        });
    }


}
