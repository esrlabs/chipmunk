import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

export enum State {
    Ready = 'Ready',
    Locked = 'Locked',
}

@Define({ name: 'BackendState' })
export class Event extends SignatureRequirement {
    public state: State;
    public job: string;

    constructor(input: { state: State; job: string }) {
        super();
        validator.isObject(input);
        this.state = input.state;
        this.job = validator.getAsString(input, 'job');
    }
}

export interface Event extends Interface {}
