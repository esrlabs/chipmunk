import { Define, Interface, SignatureRequirement } from '../declarations';
import { OutputRender, SessionAction } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'IsSdeSupportedRequest' })
export class Request extends SignatureRequirement {
    public uuid: string;
    public origin: SessionAction;

    constructor(input: { uuid: string; origin: SessionAction }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyString(input, 'uuid');
        this.origin = input.origin;
    }
}
export interface Request extends Interface {}

@Define({ name: 'IsSdeSupportedResponse' })
export class Response extends SignatureRequirement {
    public support: boolean;

    constructor(input: { support: boolean }) {
        super();
        validator.isObject(input);
        this.support = validator.getAsBool(input, 'support');
    }
}

export interface Response extends Interface {}
