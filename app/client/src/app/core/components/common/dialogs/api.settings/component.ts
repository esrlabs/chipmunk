import {Component, Input, ViewChild } from '@angular/core';
import { CommonInput                } from '../../input/component';
import { SET_KEYS                   } from '../../../../interfaces/interface.configuration.sets.system';
@Component({
    selector    : 'dialog-api-settings',
    templateUrl : './template.html',
})

export class DialogAPISettings {
    @Input() serverAPI          : string        = '';
    @Input() serverWS           : string        = '';
    @Input() serverWSProtocol   : string        = '';
    @Input() serverWSTimeout    : string        = '';

    @Input() proceed            : Function      = null;
    @Input() cancel             : Function      = null;

    @ViewChild('_serverAPI'         ) _serverAPI            : CommonInput;
    @ViewChild('_serverWS'          ) _serverWS             : CommonInput;
    @ViewChild('_serverWSProtocol'  ) _serverWSProtocol     : CommonInput;
    @ViewChild('_serverWSTimeout'   ) _serverWSTimeout      : CommonInput;

    constructor() {
        this.onProceed = this.onProceed.bind(this);
    }

    onProceed(){
        typeof this.proceed === 'function' && this.proceed({
            [SET_KEYS.API_URL]                  : this._serverAPI.getValue(),
            [SET_KEYS.WS_URL]                   : this._serverWS.getValue(),
            [SET_KEYS.WS_PROTOCOL]              : this._serverWSProtocol.getValue(),
            [SET_KEYS.WS_RECONNECTION_TIMEOUT]  : this._serverWSTimeout.getValue(),
        });
    }

}
