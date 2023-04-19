import { SerialTransportSettings } from '@platform/types/transport/serial';
import { NO_PORT } from '../bases/serial/port/common';
import { Base } from './state';
import { Action } from '@ui/tabs/sources/common/actions/action';

export class State extends Base<SerialTransportSettings> {
    public dataBits: number = 8;
    public flowControl: number = 0;
    public parity: number = 0;
    public stopBits: number = 1;

    private _baudRate: number = 9600;
    private _path: string = NO_PORT;
    private _action!: Action;

    public set action(action: Action) {
        this._action = action;
    }

    public get baudRate(): number {
        return this._baudRate;
    }

    public set baudRate(baudRate: number) {
        this._baudRate = baudRate;
        this._updateDisabledStatus();
    }

    public get path(): string {
        return this._path;
    }

    public set path(path: string) {
        this._path = path;
        this._updateDisabledStatus();
    }

    public from(opt: SerialTransportSettings) {
        this.baudRate = opt.baud_rate;
        this.dataBits = opt.data_bits;
        this.flowControl = opt.flow_control;
        this.parity = opt.parity;
        this.path = opt.path;
        this.stopBits = opt.stop_bits;
    }

    public asSourceDefinition(): SerialTransportSettings {
        return {
            baud_rate: this.baudRate,
            data_bits: this.dataBits,
            flow_control: this.flowControl,
            parity: this.parity,
            path: this.path,
            stop_bits: this.stopBits,
        };
    }

    private _updateDisabledStatus() {
        this._action && this._action.setDisabled(this._path === NO_PORT || this._baudRate === -1);
    }
}
