import {
    AfterViewInit,
    Component,
    ElementRef,
    Input,
    QueryList,
    ViewChild,
    ViewChildren,
} from '@angular/core';
import { MatOption } from '@angular/material/core';
import { MatSelectChange } from '@angular/material/select';
import { State } from '../state';

@Component({
    selector: 'app-transport-serial-options',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class TransportSerialOptions implements AfterViewInit {
    @Input() state!: State;
    @ViewChild('baudRateInput') baudRateInputRef!: ElementRef<HTMLInputElement>;
    @ViewChildren('baudRateOption') baudRateOptions!: QueryList<MatOption>;

    public _ng_custom: boolean = false;
    public readonly _ng_baudRate = [
        'Custom',
        50,
        75,
        110,
        134,
        150,
        200,
        300,
        600,
        1200,
        1800,
        2400,
        4800,
        9600,
        19200,
        38400,
        57600,
        115200,
        230400,
        460800,
        500000,
        576000,
        921600,
        1000000,
        1152000,
        1500000,
        2000000,
        2500000,
        3000000,
        3500000,
        4000000,
    ];
    public readonly _ng_dataBits = [
        {
            value: 'Five',
            name: 5,
        },
        {
            value: 'Six',
            name: 6,
        },
        {
            value: 'Seven',
            name: 7,
        },
        {
            value: 'Eight',
            name: 8,
        },
    ];
    public readonly _ng_flowControl = [
        { value: 'None', name: 'None' },
        { value: 'Software', name: 'Software' },
        { value: 'Hardware', name: 'Hardware' },
    ];
    public readonly _ng_parity = [
        { value: 'None', name: 'None' },
        { value: 'Odd', name: 'Odd' },
        { value: 'Even', name: 'Even' },
    ];
    public readonly _ng_stopBits = [
        {
            value: 'One',
            name: 1,
        },
        {
            value: 'Two',
            name: 2,
        },
    ];

    private _lastBaudRate!: number;

    public ngAfterViewInit() {
        this.baudRateOptions.forEach((option: MatOption) => {
            if (option.value === this.state.baudRate) {
                option.select();
            }
        });
    }

    public _ng_onChange(event: MatSelectChange) {
        if (typeof event.value === 'number') {
            this._ng_custom = false;
            this.state.baudRate = event.value;
            this._lastBaudRate = event.value;
        } else {
            this._ng_custom = true;
        }
    }

    public _ng_onKeyup() {
        if (this.baudRateInputRef.nativeElement.value === '') {
            this.state.baudRate = this._lastBaudRate;
        } else {
            this.state.baudRate = parseInt(this.baudRateInputRef.nativeElement.value);
        }
    }
}
