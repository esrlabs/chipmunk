import * as Toolkit from 'chipmunk.client.toolkit';

export type TPluginExportsCallback = (exports: Toolkit.IPluginExports) => void;
export type TPluginServiceCallback = (service: Toolkit.APluginService) => void;

export class ControllerPluginGate extends Toolkit.APluginServiceGate {
    private _modules: Toolkit.ICoreModules;
    private _require: Toolkit.TRequire;
    private _exports: Toolkit.IPluginExports | undefined;

    constructor(modules: Toolkit.ICoreModules, require: Toolkit.TRequire) {
        super();
        this._modules = modules;
        this._require = require;
    }

    public getCoreModules(): Toolkit.ICoreModules {
        return this._modules;
    }

    public getRequireFunc(): Toolkit.TRequire {
        return this._require;
    }

    public setPluginExports(exports: Toolkit.IPluginExports) {
        this._exports = exports;
    }

    public getPluginExports(): Toolkit.IPluginExports | undefined {
        return this._exports;
    }
}
