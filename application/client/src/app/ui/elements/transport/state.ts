import { State as UdpState } from './udp/state';
import { State as TcpState } from './tcp/state';
import { State as SerialState } from './serial/state';

import { Source, SourceDefinition } from '@platform/types/transport';

export class State {
    public udp: UdpState | undefined;
    public tcp: TcpState | undefined;
    public serial: SerialState | undefined;
    public source: Source = Source.Udp;

    private _backup: {
        udp: UdpState;
        tcp: TcpState;
        serial: SerialState;
    } = {
        udp: new UdpState(),
        tcp: new TcpState(),
        serial: new SerialState(),
    };

    constructor(defaults?: Source) {
        if (defaults !== undefined) {
            this.source = defaults;
        }
        this.switch(this.source);
    }

    public switch(source?: Source) {
        this._backup.udp = this.udp === undefined ? this._backup.udp : this.udp;
        this._backup.tcp = this.tcp === undefined ? this._backup.tcp : this.tcp;
        this._backup.serial = this.serial === undefined ? this._backup.serial : this.serial;
        switch (source === undefined ? this.source : source) {
            case Source.Udp:
                this.udp = this._backup.udp;
                this.tcp = undefined;
                this.serial = undefined;
                break;
            case Source.Tcp:
                this.tcp = this._backup.tcp;
                this.udp = undefined;
                this.serial = undefined;
                break;
            case Source.Serial:
                this.serial = this._backup.serial;
                this.tcp = undefined;
                this.udp = undefined;
                break;
        }
    }

    public asSourceDefinition(): SourceDefinition {
        return {
            udp: this.udp === undefined ? undefined : this.udp.asUDPTransportSettings(''),
        };
    }
}
