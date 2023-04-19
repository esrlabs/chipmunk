import { Component, Input, ViewChild, OnInit } from '@angular/core';
import { MatSelect } from '@angular/material/select';
import { State } from '../../../../states/serial';
import { CUSTOM_BAUD_RATE, BAUD_RATE, DATA_BITS, FLOW_CONTROL, PARITY, STOP_BITS } from '../common';
import { Options as AutocompleteOptions } from '@elements/autocomplete/component';
import { Subject } from '@platform/env/subscription';
import { MatOption } from '@angular/material/core';

@Component({
    selector: 'app-transport-serial-options',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class Options implements OnInit {
    @Input() state!: State;
    @ViewChild('baudRateSelect') baudRateSelect!: MatSelect;

    public readonly CUSTOM_BAUD_RATE = CUSTOM_BAUD_RATE;
    public readonly BAUD_RATE = BAUD_RATE;
    public readonly DATA_BITS = DATA_BITS;
    public readonly FLOW_CONTROL = FLOW_CONTROL;
    public readonly PARITY = PARITY;
    public readonly STOP_BITS = STOP_BITS;
    public readonly DEFAULT_BAUDRATE: number = 9600;
    public readonly inputs: AutocompleteOptions = {
        name: 'BaudRate',
        storage: 'serial_baudrate_recent',
        defaults: `${this.state ? this.state.baudRate : this.DEFAULT_BAUDRATE}`,
        placeholder: 'Enter custom baudrate',
        label: 'Custom baudrate',
        recent: new Subject<void>(),
    };
    public baudRates: number[] = [...BAUD_RATE];

    private _isCustom: boolean = false;
    private _lastBaudRate: number = this.DEFAULT_BAUDRATE;

    public ngOnInit() {
        this.state.baudRate = this.DEFAULT_BAUDRATE;
    }

    public get isCustom(): boolean {
        return this._isCustom;
    }

    public get baudRate(): number {
        return this.state.baudRate;
    }

    public set baudRate(baudRate: number) {
        if ((this.baudRateSelect.selected as MatOption<any>).viewValue === CUSTOM_BAUD_RATE.name) {
            this._isCustom = true;
        } else {
            this._isCustom = false;
            this.state.baudRate = baudRate;
            this._lastBaudRate = baudRate;
        }
    }

    public onBaudRateEdit(baudRate: string) {
        baudRate = baudRate.trim();
        this.state.baudRate = baudRate === '' ? this._lastBaudRate : parseInt(baudRate);
    }

    public onEnter(baudRate: string) {
        // [TODO] Disable non-number input
        baudRate = baudRate.trim();
        if (baudRate === '') {
            this.state.baudRate = this._lastBaudRate;
        } else {
            const baudRateInt: number = parseInt(baudRate);
            if (this.baudRates.indexOf(baudRateInt) === -1) {
                this.baudRates.push(baudRateInt);
                this.baudRates.sort((a, b) => a - b);
            }
            this.state.baudRate = baudRateInt;
        }
        this._isCustom = false;
    }

    public onFocusOut() {
        this._isCustom = false;
        if (this.state.baudRate === CUSTOM_BAUD_RATE.value) {
            this.state.baudRate = this._lastBaudRate;
        }
    }
}
