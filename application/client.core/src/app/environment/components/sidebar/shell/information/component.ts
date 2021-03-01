import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';

import ShellService, { IInformation } from '../services/service';

@Component({
    selector: 'app-sidebar-app-shell-information',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppShellInformationComponent implements OnInit, OnDestroy {

    public _ng_information: IInformation = {
        env: {},
        pwd: '',
        shell: '',
        shells: []
    };

    private _destroyed = false;

    constructor(private _cdRef: ChangeDetectorRef) {}

    public ngOnInit() {
        ShellService.getEnv().then((information: IInformation) => {
            this._ng_information = information;
            this._forceUpdate();
        }).catch((error: string) => {
            // TODO
            // User feedback in HTML
        });
    }

    public ngOnDestroy() {
        this._destroyed = true;
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
