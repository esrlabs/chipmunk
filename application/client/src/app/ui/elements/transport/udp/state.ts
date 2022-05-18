import * as Errors from './error';
import { MulticastInfo } from '@platform/types/transport/udp';
import { UDPTransportSettings } from '@platform/types/transport/udp';

const MULTICAST_ADDR = '255.255.255.255';
const MULTUCAST_INTERFACE = '0.0.0.0';

export class State {
    public errors = {
        bindingAddress: new Errors.ErrorState(Errors.Field.bindingAddress),
        bindingPort: new Errors.ErrorState(Errors.Field.bindingPort),
    };
    public bindingAddress: string = '';
    public bindingPort: string = '';
    public multicasts: MulticastInfo[] = [];

    public from(opt: UDPTransportSettings) {
        const pair = opt.bind_addr.split(':');
        if (pair.length !== 2) {
            return;
        }
        this.bindingAddress = pair[0];
        this.bindingPort = pair[1];
        this.multicasts = opt.multicast;
    }

    public addMulticast() {
        this.multicasts.push({
            multiaddr: MULTICAST_ADDR,
            interface: MULTUCAST_INTERFACE,
        });
    }

    public cleanMulticast() {
        this.multicasts = this.multicasts.filter((m) => {
            if (
                m.multiaddr.trim() === '' &&
                m.interface !== undefined &&
                m.interface.trim() === ''
            ) {
                return false;
            }
            return true;
        });
    }

    public asUDPTransportSettings(dest_path: string): UDPTransportSettings {
        return {
            bind_addr: `${this.bindingAddress}:${this.bindingPort}`,
            multicast: this.multicasts,
            dest_path,
        };
    }
}
