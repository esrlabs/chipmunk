import { APluginService } from "./class.plugin.service";
import { ARowCommonParser } from './class.parser.row.common';
import { ARowTypedParser } from './class.parser.row.typed';
import { ARowBoundParser } from './class.parser.row.bound';
import { ATypedRowRender } from './class.typedrow.render';
import { ASelectionParser } from './class.parser.selection';

export enum ECoreModules {
    '@angular/core' = '@angular/core',
    '@angular/common' = '@angular/common',
    '@angular/forms' = '@angular/forms',
    '@angular/platform-browser' = '@angular/platform-browser',
    'rxjs' = 'rxjs',
    'logviewer-client-complex' = 'logviewer-client-complex',
    'logviewer-client-containers' = 'logviewer-client-containers',
    'logviewer-client-primitive' = 'logviewer-client-primitive',
    'logviewer.client.toolkit' = 'logviewer.client.toolkit',
    'xterm' = 'xterm',
    'xterm/lib/addons/fit/fit' = 'xterm/lib/addons/fit/fit',
    'electron' = 'electron',
}

export interface ICoreModules {
    '@angular/core': any;
    '@angular/common': any;
    '@angular/forms': any;
    '@angular/platform-browser': any;
    'rxjs': any;
    'logviewer-client-complex': any;
    'logviewer-client-containers': any;
    'logviewer-client-primitive': any;
    'logviewer.client.toolkit': any;
    'xterm': any;
    'xterm/lib/addons/fit/fit': any;
    'electron': any;
}

export type TPluginExportEntity = ARowCommonParser | ARowTypedParser | ARowBoundParser | ATypedRowRender<any> | ASelectionParser | APluginService;

export type TRequire = (module: ECoreModules) => any;

export interface IPluginExports {
    [key: string]: TPluginExportEntity;
}

export abstract class APluginServiceGate {

    public abstract setPluginExports(exports: IPluginExports): void;
    public abstract getCoreModules(): ICoreModules;
    public abstract getRequireFunc(): TRequire;

}
