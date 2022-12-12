import { MulticastInfo } from '@platform/types/transport/udp';
import { UDPTransportSettings } from '@platform/types/transport/udp';
import { Base } from '../common/state';

import * as Errors from './error';

const MULTICAST_ADDR = '255.255.255.255';
const MULTUCAST_INTERFACE = '0.0.0.0';

export class State extends Base<UDPTransportSettings> {
    public errors: {
        bindingAddress: Errors.ErrorState;
        bindingPort: Errors.ErrorState;
    };
    public bindingAddress: string = '';
    public bindingPort: string = '';
    public multicasts: {
        fields: MulticastInfo;
        errors: {
            multiaddr: Errors.ErrorState;
            interface: Errors.ErrorState;
        };
    }[] = [];

    constructor() {
        super();
        this.errors = {
            bindingAddress: new Errors.ErrorState(Errors.Field.bindingAddress, () => {
                this.update();
            }),
            bindingPort: new Errors.ErrorState(Errors.Field.bindingPort, () => {
                this.update();
            }),
        };
    }

    public isValid(): boolean {
        if (!this.errors.bindingAddress.isValid()) {
            return false;
        }
        if (!this.errors.bindingPort.isValid()) {
            return false;
        }
        return (
            this.multicasts.filter(
                (m) => !m.errors.multiaddr.isValid() || !m.errors.interface.isValid(),
            ).length === 0
        );
    }

    public from(opt: UDPTransportSettings) {
        const pair = opt.bind_addr.split(':');
        if (pair.length !== 2) {
            return;
        }
        this.bindingAddress = pair[0];
        this.bindingPort = pair[1];
        this.multicasts = opt.multicast.map((fields) => {
            return {
                fields,
                errors: this.getMulticastErrorsValidators(),
            };
        });
    }

    public addMulticast() {
        this.multicasts.push({
            fields: {
                multiaddr: MULTICAST_ADDR,
                interface: MULTUCAST_INTERFACE,
            },
            errors: this.getMulticastErrorsValidators(),
        });
    }

    public cleanMulticast() {
        this.multicasts = this.multicasts.filter((m) => {
            if (
                m.fields.multiaddr.trim() === '' &&
                m.fields.interface !== undefined &&
                m.fields.interface.trim() === ''
            ) {
                return false;
            }
            return true;
        });
    }

    public asSourceDefinition(): UDPTransportSettings {
        return {
            bind_addr: `${this.bindingAddress}:${this.bindingPort}`,
            multicast: this.multicasts.map((m) => m.fields),
        };
    }

    protected getMulticastErrorsValidators(): {
        multiaddr: Errors.ErrorState;
        interface: Errors.ErrorState;
    } {
        return {
            multiaddr: new Errors.ErrorState(Errors.Field.multicastAddress, () => {
                this.update();
            }),
            interface: new Errors.ErrorState(Errors.Field.multicastInterface, () => {
                this.update();
            }),
        };
    }
}
