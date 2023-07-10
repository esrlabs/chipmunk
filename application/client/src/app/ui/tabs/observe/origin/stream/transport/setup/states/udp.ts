import { Destroy } from '@platform/types/env/types';
import { Action } from '../../../../../action';

import * as Errors from '../bases/udp/error';
import * as Stream from '@platform/types/observe/origin/stream/index';

const MULTICAST_ADDR = '255.255.255.255';
const MULTUCAST_INTERFACE = '0.0.0.0';

export class State implements Destroy {
    public errors: {
        address: Errors.ErrorState;
    };

    constructor(
        public readonly action: Action,
        public readonly configuration: Stream.UDP.Configuration,
    ) {
        this.errors = {
            address: new Errors.ErrorState(Errors.Field.bindingAddress, () => {
                // this.update();
            }),
        };
    }

    public destroy(): void {
        // Having method "destroy()" is requirement of session's storage
    }

    public drop() {
        this.configuration.configuration.bind_addr = Stream.UDP.Configuration.initial().bind_addr;
        this.configuration.configuration.multicast = Stream.UDP.Configuration.initial().multicast;
    }

    public addMulticast() {
        this.configuration.configuration.multicast.push({
            multiaddr: MULTICAST_ADDR,
            interface: MULTUCAST_INTERFACE,
        });
    }

    public removeMulticast(index: number) {
        index > -1 && this.configuration.configuration.multicast.splice(index, 1);
    }
}
