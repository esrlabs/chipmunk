import { Component, Input } from '@angular/core';
import { State } from '../../../states/serial';
import { Action } from '@ui/tabs/sources/common/actions/action';
import { NO_PORT, CUSTOM_PORT } from './common';

@Component({
    selector: 'app-transport-serial-port',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class Port {
    @Input() action!: Action;
    @Input() state!: State;

    public NO_PORT = NO_PORT;
    public CUSTOM_PORT = CUSTOM_PORT;
}
