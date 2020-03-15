declare var Electron: any;

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef, ViewEncapsulation } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import ElectronIpcService, { IPCMessages } from '../../../services/service.electron.ipc';

import * as Toolkit from 'chipmunk.client.toolkit';

export interface IApplicationVersions {
    'electron': string;
    'electron-rebuild': string;
    'chipmunk.client.toolkit': string;
    'chipmunk.plugin.ipc': string;
    'chipmunk-client-material': string;
    'angular-core': string;
    'angular-material': string;
    'force': string;
}

interface IDependency {
    name: string;
    version: string;
    description: string;
}

const CDependencies = {
    'electron': { name: 'Electron', description: 'Electron framework' },
    'electron-rebuild': { name: 'Electron Rebuild', description: 'Electron rebuild library' },
    'chipmunk.client.toolkit': { name: 'ToolKit', description: 'Rendering library' },
    'chipmunk.plugin.ipc': { name: 'IPC', description: 'Chipmunk IPC  communication library' },
    'chipmunk-client-material': { name: 'Chipmunk Material', description: 'Chipmunk UI library' },
    'angular-core': { name: 'Angular', description: 'Angular Core' },
    'angular-material': { name: 'Angular Material', description: 'Angular Material Library' },
};

const CUrls = {
    repo: 'https://github.com/esrlabs/chipmunk',
    issues: 'https://github.com/esrlabs/chipmunk/issues',
};

@Component({
    selector: 'app-tabs-abbout',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})

export class TabAboutComponent implements OnDestroy, AfterContentInit {

    @Input() public data: IPCMessages.TabCustomAbout;
    public _ng_version: string = '';
    public _ng_dependencies: IDependency[] = [];

    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = { };
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    public ngAfterContentInit() {
        this._ng_version = this.data.version;
        Object.keys(CDependencies).forEach((key: string) => {
            if (this.data.dependencies[key] === undefined) {
                return;
            }
            this._ng_dependencies.push({
                name: CDependencies[key].name,
                description: CDependencies[key].description,
                version: this.data.dependencies[key],
            });
        });
    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        this._destroyed = true;
    }

    public _ng_onGitHubOpen() {
        Electron.shell.openExternal(CUrls.repo);
    }

    public _ng_onGitHubIssuesOpen() {
        Electron.shell.openExternal(CUrls.issues);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
