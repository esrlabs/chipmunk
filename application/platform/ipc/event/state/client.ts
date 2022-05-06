import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

export enum State {
    Ready = 'Ready',
    Loading = 'Loading',
}

@Define({ name: 'ClientState' })
export class Event extends SignatureRequirement {
    public state: State;

    constructor(input: {
        state: State;
    }) {
        super();
        validator.isObject(input);
        this.state = input.state;
    }
}

export interface Event extends Interface {}
