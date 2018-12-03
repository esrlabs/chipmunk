import {Component, Input, ViewChild } from '@angular/core';
import { SimpleDropDownList         } from '../../lists/simple-drop-down/component';
import { CommonInput                } from '../../input/component';
import { IDltHistory, IDltSettings, DltLogLevel, dltDefaultsSettings  } from '../../../../handles/handle.open.dlt.stream';

@Component({
    selector    : 'dialog-dlt-settings',
    templateUrl : './template.html',
})

export class DialogDltSettings {

    @Input() host               : string        = dltDefaultsSettings.host;
    @Input() port               : number        = dltDefaultsSettings.port;
    @Input() settings           : IDltSettings  = dltDefaultsSettings.settings;

    @Input() proceed            : Function      = null;
    @Input() cancel             : Function      = null;

    @ViewChild('_host'                  ) _host                 : CommonInput;
    @ViewChild('_port'                  ) _port                 : CommonInput;
    @ViewChild('_logLevel'              ) _logLevel             : SimpleDropDownList;

    private _showExtra: boolean = false;
    private _logLevels: Array<{ caption: string, value: any }> = [];

    constructor() {
        this.onProceed = this.onProceed.bind(this);
        this._logLevels = Object.keys(DltLogLevel).map((key: string) => {
            return {
                caption: key,
                value: DltLogLevel[key]
            };
        });
    }

    onProceed(){
        this.proceed({
            host                : this._host.getValue(),
            port                : parseInt(this._port.getValue(), 10),
            settings            : {
                logLevel        : parseInt(this._logLevel.getValue(), 10)
            }
        } as IDltHistory);
    }

    onShowHideExtra(){
        this._showExtra = !this._showExtra;
    }

}
