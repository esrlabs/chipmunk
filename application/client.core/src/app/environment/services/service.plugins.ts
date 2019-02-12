import { Compiler, Injector } from '@angular/core';
import ServiceElectronIpc from 'logviewer.client.electron.ipc';
import { IPCMessages, Subscription } from 'logviewer.client.electron.ipc';
import * as AngularCore from '@angular/core';
import * as AngularCommon from '@angular/common';
import * as Tools from '../tools/index';

type TPluginModule = any;

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

    private _loadAndInit(name: string, location: string): Promise<TPluginModule> {
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

                        /*
                        // We can take component manualy and inject it.
                        const componentFactory = mwcf.componentFactories.find(e => e.selector === 'selector_of_plugin_component');
                        if (componentFactory) {
                            const componentRef = this.content.createComponent(componentFactory);
                            componentRef.instance.data = 'Some Data';
                        }*/
                        resolve();
                    }).catch((compileError: Error) => {
                        reject(new Error(this._logger.error(`Fail to compile plugin "${name}" due error: ${compileError.message}`)));
                    });
                    /*
                    exports.doSomething();
                    this._compiler.compileModuleAndAllComponentsAsync<any>(exports['PluginCModule']).then((mwcf) => {
                        const componentFactory = mwcf.componentFactories.find(e => e.selector === 'lib-plugin-c'); // find the entry component
                        if (componentFactory) {
                        const componentRef = this.content.createComponent(componentFactory);
                        // componentRef.instance.data = 'Some Data';
                        }
                    });
                    console.log(source);
                    */
                }).catch((responseError: Error) => {
                    reject(new Error(this._logger.error(`Response of plugin "${name}" wasn't parsed correctly due error: ${responseError.message}`)));
                });
            }).catch((fetchError: Error) => {
                reject(new Error(this._logger.error(`Plugin "${name}" wasn't loaded due error: ${fetchError.message}`)));
            });
        });
    }

    private _deliveryApps(): Promise<void> {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    private _ipc_onRenderMountPlugin(event: IPCMessages.RenderMountPlugin): void {
        this._logger.env(`Information about plugin "${event.name}" has been gotten. Starting loading & initialization.`);
        this._loadAndInit(event.name, event.location).then((PluginModule: TPluginModule) => {
            console.log(PluginModule);
            // Here we should do delivery
        }).catch((loadError: Error) => {
            this._logger.error(`Fail to load and initialize plugin due error: ${loadError.message}`);
        });
    }


}
