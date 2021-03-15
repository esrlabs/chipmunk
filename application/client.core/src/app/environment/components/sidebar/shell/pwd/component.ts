import { AfterViewInit, Component, Input, OnDestroy } from '@angular/core';
import { ShellService } from '../services/service';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-sidebar-app-shell-input-pwd',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppShellInputPwdComponent implements AfterViewInit, OnDestroy {

    @Input() public pwd: string;
    @Input() public sessionID: string;
    @Input() public service: ShellService;
    @Input() public setPwd: (pwd: string) => void;
    @Input() public close: () => void;

    public _ng_valid: boolean = true;
    public _ng_validColor: string = '#eaeaea';
    public _ng_invalidColor: string = '#fd1515';

    private _logger: Toolkit.Logger = new Toolkit.Logger('SidebarAppShellInputPwdComponent');
    private _prevPwd = '';

    constructor() { }

    public ngAfterViewInit() {
        this._prevPwd = this.pwd;
    }

    public ngOnDestroy() {
        if (this.pwd.trim() === '') {
            this.pwd = this._prevPwd;
       }
    }

    public _ng_onKeyUp(event: KeyboardEvent) {
        if (!this._ng_valid) {
            this._ng_valid = true;
        }
    }

    public _ng_setPwd() {
        this.service.setEnv({
            session: this.sessionID,
            pwd: this.pwd
        }).then(() => {
            this.setPwd(this.pwd);
            this.close();
        }).catch((error: string) => {
            this._ng_valid = false;
            this._logger.error(error);
        });
    }

}
