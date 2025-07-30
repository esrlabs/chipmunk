import { Define, Interface, SignatureRequirement } from '../declarations';
import { ComponentsList, SessionAction } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'GetCompatibleSetupRequest' })
export class Request extends SignatureRequirement {
    public origin: SessionAction;

    constructor(input: { origin: SessionAction }) {
        super();
        validator.isObject(input);
        this.origin = input.origin;
    }
}
export interface Request extends Interface {}

@Define({ name: 'GetCompatibleSetupResponse' })
export class Response extends SignatureRequirement {
    public components: ComponentsList;

    constructor(input: { components: ComponentsList }) {
        super();
        validator.isObject(input);
        this.components = validator.getAsObj(input, 'components');
    }
}

export interface Response extends Interface {}
