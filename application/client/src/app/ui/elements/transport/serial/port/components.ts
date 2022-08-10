import { Component, Input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Horizontal, Vertical } from '@ui/service/popup/popup';
import { TransportSerialOptions } from '../options/component';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { State } from '../state';

import SerialService from '../service/service';

@Component({
    selector: 'app-transport-serial-available',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportSerialAvailable {
    @Input() port: string = '';
    @Input() state!: State;

    public _ng_available: boolean = true;
    public _ng_recent: string[] = [];
    public _ng_inputCtrl = new FormControl();
    public _ng_service = SerialService;

    public _ng_onPortClick() {
        this.state.path = SerialService.setSelected(this.port);
    }

    public _ng_onOptions(event: MouseEvent) {
        event.stopPropagation();
        this.ilc().services.ui.popup.open({
            component: {
                factory: TransportSerialOptions,
                inputs: {
                    state: this.state,
                },
            },
            closeOnBGClick: true,
            closeOnKey: 'Escape',
            position: {
                vertical: Vertical.center,
                horizontal: Horizontal.center,
            },
        });
    }
}
export interface TransportSerialAvailable extends IlcInterface {}
