import { Define, Interface, SignatureRequirement } from '../declarations';

@Define({ name: 'CLIProcessingFinished' })
export class Event extends SignatureRequirement {
    constructor() {
        super();
    }
}

export interface Event extends Interface {}
