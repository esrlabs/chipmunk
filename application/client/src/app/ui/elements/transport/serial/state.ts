import { SerialTransportSettings } from '@platform/types/transport/serial';
import { Base } from '../common/state';

export class State extends Base<SerialTransportSettings> {
    public baudRate: number = 9600;
    public dataBits: string = 'Eight';
    public flowControl: string = 'None';
    public parity: string = 'None';
    public path: string = '';
    public stopBits: string = 'One';

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
}
