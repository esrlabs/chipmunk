import {Component, Input, ViewChild } from '@angular/core';
import { SimpleCheckbox             } from '../../checkboxes/simple/component';
import { CommonInput                } from '../../input/component';
import { DefaultsTelnetSettings     } from './defaults.settings';

const defaults = new DefaultsTelnetSettings();

@Component({
    selector    : 'dialog-telnet-settings',
    templateUrl : './template.html',
})

export class DialogTelnetSettings {

    @Input() host                : string        = defaults.host;
    @Input() port                : number        = defaults.port;
    @Input() timeout             : number        = defaults.timeout;
    @Input() shellPrompt         : string        = defaults.shellPrompt;
    @Input() loginPrompt         : string        = defaults.loginPrompt;
    @Input() passwordPrompt      : string        = defaults.passwordPrompt;
    @Input() failedLoginMatch    : string        = defaults.failedLoginMatch;
    @Input() initialLFCR         : boolean       = defaults.initialLFCR;
    @Input() username            : string        = defaults.username;
    @Input() password            : string        = defaults.password;
    @Input() irs                 : string        = defaults.irs;
    @Input() ors                 : string        = defaults.ors;
    @Input() echoLines           : number        = defaults.echoLines;
    @Input() stripShellPrompt    : boolean       = defaults.stripShellPrompt;
    @Input() pageSeparator       : string        = defaults.pageSeparator;
    @Input() negotiationMandatory: boolean       = defaults.negotiationMandatory;
    @Input() execTimeout         : number        = defaults.execTimeout;
    @Input() sendTimeout         : number        = defaults.sendTimeout;
    @Input() maxBufferLength     : number        = defaults.maxBufferLength;
    @Input() debug               : boolean       = defaults.debug;

    @Input() proceed        : Function      = null;
    @Input() cancel         : Function      = null;

    @ViewChild('_host'                  ) _host                 : CommonInput;
    @ViewChild('_port'                  ) _port                 : CommonInput;
    @ViewChild('_timeout'               ) _timeout              : CommonInput;
    @ViewChild('_shellPrompt'           ) _shellPrompt          : CommonInput;
    @ViewChild('_loginPrompt'           ) _loginPrompt          : CommonInput;
    @ViewChild('_passwordPrompt'        ) _passwordPrompt       : CommonInput;
    @ViewChild('_failedLoginMatch'      ) _failedLoginMatch     : CommonInput;
    @ViewChild('_initialLFCR'           ) _initialLFCR          : SimpleCheckbox;
    @ViewChild('_username'              ) _username             : CommonInput;
    @ViewChild('_password'              ) _password             : CommonInput;
    @ViewChild('_irs'                   ) _irs                  : CommonInput;
    @ViewChild('_ors'                   ) _ors                  : CommonInput;
    @ViewChild('_echoLines'             ) _echoLines            : CommonInput;
    @ViewChild('_stripShellPrompt'      ) _stripShellPrompt     : SimpleCheckbox;
    @ViewChild('_pageSeparator'         ) _pageSeparator        : CommonInput;
    @ViewChild('_negotiationMandatory'  ) _negotiationMandatory : SimpleCheckbox;
    @ViewChild('_execTimeout'           ) _execTimeout          : CommonInput;
    @ViewChild('_sendTimeout'           ) _sendTimeout          : CommonInput;
    @ViewChild('_maxBufferLength'       ) _maxBufferLength      : CommonInput;
    @ViewChild('_debug'                 ) _debug                : SimpleCheckbox;



    constructor() {
        this.onProceed = this.onProceed.bind(this);
    }

    onProceed(){
        this.proceed({
            host                : this._host.getValue(),
            port                : parseInt(this._port.getValue(), 10),
            timeout             : parseInt(this._timeout.getValue(), 10),
            shellPrompt         : this._shellPrompt.getValue(),
            loginPrompt         : this._loginPrompt.getValue(),
            passwordPrompt      : this._passwordPrompt.getValue(),
            failedLoginMatch    : this._failedLoginMatch.getValue(),
            initialLFCR         : this._initialLFCR.getValue(),
            username            : this._username.getValue(),
            password            : this._password.getValue(),
            irs                 : this._irs.getValue(),
            ors                 : this._ors.getValue(),
            echoLines           : parseInt(this._echoLines.getValue(), 10),
            stripShellPrompt    : this._stripShellPrompt.getValue(),
            pageSeparator       : this._pageSeparator.getValue(),
            negotiationMandatory: this._negotiationMandatory.getValue(),
            execTimeout         : parseInt(this._execTimeout.getValue(), 10),
            sendTimeout         : parseInt(this._sendTimeout.getValue(), 10),
            maxBufferLength     : parseInt(this._maxBufferLength.getValue(), 10),
            debug               : this._debug.getValue()
        });
    }

}
