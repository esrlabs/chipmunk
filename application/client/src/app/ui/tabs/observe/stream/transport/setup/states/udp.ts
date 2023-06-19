import { Destroy } from '@platform/types/env/types';
import { Action } from '../../../../action';

import * as Errors from '../bases/udp/error';
import * as Stream from '@platform/types/observe/origin/stream/index';

const MULTICAST_ADDR = '255.255.255.255';
const MULTUCAST_INTERFACE = '0.0.0.0';

export interface IMulticastInfo {
    fields: Stream.UDP.Multicast;
    errors: {
        multiaddr: Errors.ErrorState;
        interface: Errors.ErrorState;
    };
}

export class State extends Stream.UDP.Configuration implements Destroy {
    public action: Action;

    public errors: {
        address: Errors.ErrorState;
    };

    constructor(
        action: Action,
        configuration: Stream.UDP.IConfiguration = Stream.UDP.Configuration.initial(),
    ) {
        super(configuration);
        this.action = action;
        this.errors = {
            address: new Errors.ErrorState(Errors.Field.bindingAddress, () => {
                // this.update();
            }),
        };
        this.watcher.subscribe(() => {
            console.log(`>>>>>>>>>>>>>>> UPDATED`);
        });
    }

    public destroy(): void {
        // Having method "destroy()" is requirement of session's storage
    }

    public drop() {
        this.configuration.bind_addr = Stream.UDP.Configuration.initial().bind_addr;
        this.configuration.multicast = Stream.UDP.Configuration.initial().multicast;
    }

    public from(opt: Stream.UDP.IConfiguration) {
        this.overwrite(opt);
        const pair = opt.bind_addr.split(':');
        if (pair.length !== 2) {
            return;
        }
    }

    public addMulticast() {
        this.configuration.multicast.push({
            multiaddr: MULTICAST_ADDR,
            interface: MULTUCAST_INTERFACE,
        });
    }

    public removeMulticast(index: number) {
        index > -1 && this.configuration.multicast.splice(index, 1);
    }
}
