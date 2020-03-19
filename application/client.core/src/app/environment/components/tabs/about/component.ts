declare var Electron: any;

import { Component, OnDestroy, ChangeDetectorRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef, ViewEncapsulation } from '@angular/core';
import { Subscription, Subject, Observable } from 'rxjs';
import { IPCMessages } from '../../../services/service.electron.ipc';
import { copyTextToClipboard } from '../../../controller/helpers/clipboard';
import { IDependencyVersion, CDependencies, getDependenciesVersions } from '../../../controller/helpers/versions';
import * as Toolkit from 'chipmunk.client.toolkit';



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
    public _ng_dependencies: IDependencyVersion[] = [];

    private _subscriptions: { [key: string]: Toolkit.Subscription | Subscription } = { };
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    public ngAfterContentInit() {
        this._ng_version = this.data.version;
        this._ng_dependencies = getDependenciesVersions(this.data.dependencies);
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

    public _ng_onCopyToClipboard() {
        let text = `Version: ${this.data.version}\n`;
        Object.keys(CDependencies).forEach((key: string) => {
            if (this.data.dependencies[key] === undefined) {
                return;
            }
            text += `${CDependencies[key].name}: ${this.data.dependencies[key]}\n`;
        });
        copyTextToClipboard(text);
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
