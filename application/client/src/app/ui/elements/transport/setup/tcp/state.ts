import { TCPTransportSettings } from '@platform/types/transport/tcp';
import { Base } from '../common/state';

import * as Errors from './error';

export class State extends Base<TCPTransportSettings> {
    public errors = {
        bindingAddress: new Errors.ErrorState(Errors.Field.bindingAddress),
        bindingPort: new Errors.ErrorState(Errors.Field.bindingPort),
    };
    public bindingAddress: string = '';
    public bindingPort: string = '';

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
