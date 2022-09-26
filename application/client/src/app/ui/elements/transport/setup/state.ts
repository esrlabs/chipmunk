import { State as UdpState } from './udp/state';
import { State as TcpState } from './tcp/state';
import { State as SerialState } from './serial/state';
import { State as ProcessState } from './process/state';

import { Source, SourceDefinition } from '@platform/types/transport';

export class State {
    public udp: UdpState | undefined;
    public tcp: TcpState | undefined;
    public serial: SerialState | undefined;
    public process: ProcessState | undefined;
    public source: Source = Source.Udp;

    private _backup: {
        udp: UdpState;
        tcp: TcpState;
        serial: SerialState;
        process: ProcessState;
    } = {
        udp: new UdpState(),
        tcp: new TcpState(),
        serial: new SerialState(),
        process: new ProcessState(),
    };

    constructor(defaults?: Source) {
        if (defaults !== undefined) {
            this.source = defaults;
        }
        this.switch(this.source);
    }

    public from(source: SourceDefinition) {
        if (source.udp !== undefined) {
            this.udp = this._backup.udp;
            this.udp.from(source.udp);
            this.switch(Source.Udp);
            return;
        }
        if (source.process !== undefined) {
            this.process = this._backup.process;
            this.process.from(source.process);
            this.switch(Source.Process);
            return;
        }
    }

    public switch(source?: Source) {
        this._backup.udp = this.udp === undefined ? this._backup.udp : this.udp;
        this._backup.tcp = this.tcp === undefined ? this._backup.tcp : this.tcp;
        this._backup.serial = this.serial === undefined ? this._backup.serial : this.serial;
        this._backup.process = this.process === undefined ? this._backup.process : this.process;
        if (source !== undefined) {
            this.source = source;
        }
        switch (source === undefined ? this.source : source) {
            case Source.Udp:
                this.udp = this._backup.udp;
                this.tcp = undefined;
                this.serial = undefined;
                this.process = undefined;
                break;
            case Source.Tcp:
                this.tcp = this._backup.tcp;
                this.udp = undefined;
                this.serial = undefined;
                this.process = undefined;
                break;
            case Source.Serial:
                this.serial = this._backup.serial;
                this.tcp = undefined;
                this.udp = undefined;
                this.process = undefined;
                break;
            case Source.Process:
                this.process = this._backup.process;
                this.tcp = undefined;
                this.udp = undefined;
                this.serial = undefined;
                break;
        }
    }

    public asSourceDefinition(): SourceDefinition {
        return {
            udp: this.udp === undefined ? undefined : this.udp.accept().asSourceDefinition(),
            tcp: this.tcp === undefined ? undefined : this.tcp.accept().asSourceDefinition(),
            process:
                this.process === undefined ? undefined : this.process.accept().asSourceDefinition(),
            serial:
                this.serial === undefined ? undefined : this.serial.accept().asSourceDefinition(),
        };
    }
}
