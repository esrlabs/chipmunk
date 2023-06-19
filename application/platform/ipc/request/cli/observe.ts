import { Define, Interface, SignatureRequirement } from '../declarations';
import { IObserve, Observe } from '../../../types/observe/index';

import * as validator from '../../../env/obj';

@Define({ name: 'ObserveCLICommandRequest' })
export class Request extends SignatureRequirement {
    public observe: IObserve;

    constructor(input: { observe: IObserve }) {
        super();
        validator.isObject(input);
        this.observe = validator.getAsObj(input, 'observe');
        const error = Observe.validate(this.observe);
        if (error instanceof Error) {
            throw error;
        }
    }
}

export interface Request extends Interface {}

@Define({ name: 'ObserveCLICommandResponse' })
export class Response extends SignatureRequirement {
    public session: string | undefined;
    public error?: string;

    constructor(input: { session: string | undefined; error?: string }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyStringOrAsUndefined(input, 'session');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
