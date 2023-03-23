import { TCPTransportSettings } from '@platform/types/transport/tcp';
import { Base } from './state';

import * as Errors from '../bases/tcp/error';

export class State extends Base<TCPTransportSettings> {
    public errors: {
        bindingAddress: Errors.ErrorState;
        bindingPort: Errors.ErrorState;
    };
    public bindingAddress: string = '';
    public bindingPort: string = '';

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
        return true;
    }

    public drop() {
        this.bindingAddress = '';
        this.bindingPort = '';
    }

    public from(opt: TCPTransportSettings) {
        const pair = opt.bind_addr.split(':');
        if (pair.length !== 2) {
            return;
        }
        this.bindingAddress = pair[0];
        this.bindingPort = pair[1];
    }

    public asSourceDefinition(): TCPTransportSettings {
        return {
            bind_addr: `${this.bindingAddress}:${this.bindingPort}`,
        };
    }
}
