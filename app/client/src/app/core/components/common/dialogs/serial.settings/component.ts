import {Component, Input, ViewChild } from '@angular/core';
import { SimpleCheckbox             } from '../../checkboxes/simple/component';
import { CommonInput                } from '../../input/component';
@Component({
    selector    : 'dialog-serial-settings',
    templateUrl : './template.html',
})

export class DialogSerialSettings {
    @Input() lock           : boolean       = true;
    @Input() baudRate       : number        = 921600;
    @Input() dataBits       : number        = 8;
    @Input() stopBits       : number        = 1;
    @Input() rtscts         : boolean       = false;
    @Input() xon            : boolean       = false;
    @Input() xoff           : boolean       = false;
    @Input() xany           : boolean       = false;
    @Input() bufferSize     : number        = 65536;
    @Input() vmin           : number        = 1;
    @Input() vtime          : number        = 0;
    @Input() vtransmit      : number        = 50;
    @Input() proceed        : Function      = null;
    @Input() cancel         : Function      = null;

    @ViewChild('_lock'       ) _lock        : SimpleCheckbox;
    @ViewChild('_baudRate'   ) _baudRate    : CommonInput;
    @ViewChild('_dataBits'   ) _dataBits    : CommonInput;
    @ViewChild('_stopBits'   ) _stopBits    : CommonInput;
    @ViewChild('_rtscts'     ) _rtscts      : SimpleCheckbox;
    @ViewChild('_xon'        ) _xon         : SimpleCheckbox;
    @ViewChild('_xoff'       ) _xoff        : SimpleCheckbox;
    @ViewChild('_xany'       ) _xany        : SimpleCheckbox;
    @ViewChild('_bufferSize' ) _bufferSize  : CommonInput;
    @ViewChild('_vmin'       ) _vmin        : CommonInput;
    @ViewChild('_vtime'      ) _vtime       : CommonInput;
    @ViewChild('_vtransmit'  ) _vtransmit   : CommonInput;


    constructor() {
        this.onProceed = this.onProceed.bind(this);
    }

    onProceed(){
        this.proceed({
            lock        : this._lock.getValue(),
            baudRate    : parseInt(this._baudRate.getValue(), 10),
            dataBits    : parseInt(this._dataBits.getValue(), 10),
            stopBits    : parseInt(this._stopBits.getValue(), 10),
            rtscts      : this._rtscts.getValue(),
            xon         : this._xon.getValue(),
            xoff        : this._xoff.getValue(),
            xany        : this._xany.getValue(),
            bufferSize  : parseInt(this._bufferSize.getValue(), 10),
            vmin        : parseInt(this._vmin.getValue(), 10),
            vtime       : parseInt(this._vtime.getValue(), 10),
            vtransmit   : parseInt(this._vtransmit.getValue(), 10)
        });
    }

}
