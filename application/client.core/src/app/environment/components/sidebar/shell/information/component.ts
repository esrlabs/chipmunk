import { Component, Input, OnInit } from '@angular/core';

import { ShellService, IInformation } from '../services/service';

import * as Toolkit from 'chipmunk.client.toolkit';

enum EStatus {
    ready = 'ready',
    error = 'error',
    loading = 'loading',
}

@Component({
    selector: 'app-sidebar-app-shell-information',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppShellInformationComponent implements OnInit {

    @Input() public service: ShellService;

    public _ng_status: EStatus = EStatus.loading;
    public _ng_error: string = '';
    public _ng_information: IInformation = {
        env: {},
        pwd: '',
        shell: '',
        shells: []
    };

    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellInformationComponent');

    constructor() {}

    public ngOnInit() {
        this.service.getEnv().then((information: IInformation) => {
            this._ng_status = EStatus.ready;
            this._ng_information = information;
        }).catch((error: string) => {
            this._ng_status = EStatus.error;
            this._ng_error = error;
            this._logger.error(error);
        });
    }

}
