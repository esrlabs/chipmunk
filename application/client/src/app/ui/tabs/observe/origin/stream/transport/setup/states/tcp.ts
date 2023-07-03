import { Destroy } from '@platform/types/env/types';
import { Action } from '@ui/tabs/observe/action';

import * as Errors from '../bases/tcp/error';
import * as Stream from '@platform/types/observe/origin/stream/index';

export class State implements Destroy {
    public errors: {
        address: Errors.ErrorState;
    };

    constructor(
        public readonly action: Action,
        public readonly configuration: Stream.TCP.Configuration,
    ) {
        this.errors = {
            address: new Errors.ErrorState(Errors.Field.address, () => {
                // this.update();
            }),
        };
    }

    public destroy(): void {
        // Having method "destroy()" is requirement of session's storage
    }

    public isValid(): boolean {
        if (!this.errors.address.isValid()) {
            return false;
        }
        return true;
    }

    public drop() {
        this.configuration.configuration.bind_addr = Stream.TCP.Configuration.initial().bind_addr;
    }

}
