import {Component, Input, Output, ViewChild, AfterContentInit } from '@angular/core';
import { CommonInput                } from '../../input/component';
import {IServerSetting, IVisualSettings} from '../../../../modules/controller.settings';

@Component({
    selector    : 'dialog-api-settings',
    templateUrl : './template.html',
})

export class DialogAPISettings implements AfterContentInit{
    @Input() server             : IServerSetting    = null;
    @Input() proceed            : Function          = null;
    @Input() cancel             : Function          = null;
    @Input() register           : Function          = null;

    @Output() getData() : IServerSetting {
        return {
            API_URL                 : this._API_URL.getValue(),
            WS_URL                  : this._WS_URL.getValue(),
            WS_PROTOCOL             : this._WS_PROTOCOL.getValue(),
            WS_RECONNECTION_TIMEOUT : this._WS_RECONNECTION_TIMEOUT.getValue()
        };
    };

    private registered: boolean = false;

    @ViewChild('_API_URL'                   ) _API_URL                  : CommonInput;
    @ViewChild('_WS_URL'                    ) _WS_URL                   : CommonInput;
    @ViewChild('_WS_PROTOCOL'               ) _WS_PROTOCOL              : CommonInput;
    @ViewChild('_WS_RECONNECTION_TIMEOUT'   ) _WS_RECONNECTION_TIMEOUT  : CommonInput;

    constructor() {
        this.onProceed = this.onProceed.bind(this);
    }

    ngAfterContentInit(){
        if (this.register !== null && !this.registered) {
            this.register({
                getData: this.getData.bind(this),
                section: 'server'
            });
            this.registered = true;
        }
    }

    onProceed(){
        typeof this.proceed === 'function' && this.proceed(this.getData());
    }

}
