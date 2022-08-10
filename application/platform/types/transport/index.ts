import * as Udp from './udp';
import * as Tcp from './tcp';
import * as Process from './process';
import * as Serial from './serial';

export enum Source {
    Tcp = 'Tcp',
    Udp = 'Udp',
    Serial = 'Serial',
    Process = 'Process',
}

export interface SourceDefinition {
    udp?: Udp.UDPTransportSettings;
    tcp?: Tcp.TCPTransportSettings;
    process?: Process.ProcessTransportSettings;
    serial?: Serial.SerialTransportSettings;
}

export class SourceDefinitionHolder {
    public source: SourceDefinition;
    constructor(source: SourceDefinition) {
        this.source = source;
        if (
            this.source.udp === undefined &&
            this.source.tcp === undefined &&
            this.source.serial === undefined &&
            this.source.process === undefined
        ) {
            throw new Error(`Type of source isn't defined.`);
        }
    }
    public uuid(): string {
        if (this.source.udp !== undefined) {
            return `${this.source.udp.bind_addr}${this.source.udp.multicast
                .map((m) => m.multiaddr)
                .join('_')}`;
        } else if (this.source.tcp !== undefined) {
            return 'tcp_connection';
        } else if (this.source.serial !== undefined) {
            return `${this.source.serial.path}_${this.source.serial.baud_rate}_${this.source.serial.data_bits}_${this.source.serial.flow_control}_${this.source.serial.parity}`;
        } else if (this.source.process !== undefined) {
            return 'command_caller';
        }
        throw new Error(`Type of source isn't defined.`);
    }
}
