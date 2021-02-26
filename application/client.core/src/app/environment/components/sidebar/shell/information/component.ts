import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';

import ElectronIpcService, { IPCMessages } from '../../../../services/service.electron.ipc';
import ShellService from '../services/service';

import * as Toolkit from 'chipmunk.client.toolkit';

interface IInformation {
    env: { [key: string]: string};
    shells: string[];
    shell: string;
    pwd: string;
}

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

    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellInformation');
    private _destroyed = false;

    constructor(private _cdRef: ChangeDetectorRef) {}

    public ngOnInit() {
        this._init();
    }

    public ngOnDestroy() {
        this._destroyed = true;
    }

    private _init() {
        ElectronIpcService.request(new IPCMessages.ShellEnvRequest({ session: ShellService.session.getGuid() }), IPCMessages.ShellEnvResponse).then((response: IPCMessages.ShellEnvResponse) => {
            if (response.error !== undefined) {
                this._logger.error(`Failed to reqeust environment information due to Error: ${response.error}`);
            } else {
                this._ng_information = {
                    env: Object.assign({}, response.env),
                    shells: [...response.shells],
                    shell: response.shell,
                    pwd: response.pwd,
                };
                this._forceUpdate();
            }
        }).catch((error: Error) => {
            this._logger.error(`Failed to reqeust environment information due to Error: ${error}`);
        });
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
