import { Define, Interface, SignatureRequirement } from '../declarations';
import { IObserve, Observe } from '../../../types/observe/index';

import * as validator from '../../../env/obj';

@Define({ name: 'StartObserveRequest' })
export class Request extends SignatureRequirement {
    public session: string;
    public observe: IObserve;

    constructor(input: { session: string; observe: IObserve }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.observe = validator.getAsObj(input, 'observe');
        const error = Observe.validate(this.observe);
        if (error instanceof Error) {
            throw error;
        }
    }
}

export interface Request extends Interface {}

@Define({ name: 'StartObserveResponse' })
export class Response extends SignatureRequirement {
    public session: string;
    public error?: string;

    constructor(input: { session: string; error?: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
