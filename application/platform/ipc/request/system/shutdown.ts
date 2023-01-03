import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

export enum State {
    Ready = 'Ready',
    InProgress = 'InProgress',
}
@Define({ name: 'SystemShutdownRequest' })
export class Request extends SignatureRequirement {
    public force: boolean;

    constructor(input: { force: boolean }) {
        super();
        validator.isObject(input);
        this.force = validator.getAsBool(input, 'force');
    }
}
export interface Request extends Interface {}

@Define({ name: 'SystemShutdownResponse' })
export class Response extends SignatureRequirement {
    public state: State;

    constructor(input: { state: State }) {
        super();
        validator.isObject(input);
        this.state = validator.getAsNotEmptyString(input, 'state') as State;
    }
}

export interface Response extends Interface {}
