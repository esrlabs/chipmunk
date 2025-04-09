import { Define, Interface, SignatureRequirement } from '../declarations';
import { Field, SourceOrigin } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'ValidateComponentsOptionsRequest' })
export class Request extends SignatureRequirement {
    public origin: SourceOrigin;
    public target: string;
    public fields: Field[];

    constructor(input: { origin: SourceOrigin; target: string; fields: Field[] }) {
        super();
        validator.isObject(input);
        this.target = validator.getAsNotEmptyString(input, 'target');
        this.origin = validator.getAsObj(input, 'origin');
        this.fields = validator.getAsArray(input, 'fields');
    }
}
export interface Request extends Interface {}

@Define({ name: 'ValidateComponentsOptionsResponse' })
export class Response extends SignatureRequirement {
    public errors: Map<string, string>;

    constructor(input: { errors: Map<string, string> }) {
        super();
        validator.isObject(input);
        this.errors = validator.getAsMap(input, 'errors');
    }
}

export interface Response extends Interface {}
