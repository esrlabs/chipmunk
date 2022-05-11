import * as Udp from './udp';
import * as Tcp from './tcp';
import * as Process from './process';
import * as Serial from './serial';

export enum Source {
    Tcp = 'Tcp',
    Udp = 'Udp',
    Serial = 'Serial',
}

export interface SourceDefinition {
    udp?: Udp.UDPTransportSettings;
    tcp?: Tcp.TCPTransportSettings;
    process?: Process.ProcessTransportSettings;
    serial?: Serial.SerialTransportSettings;
}
