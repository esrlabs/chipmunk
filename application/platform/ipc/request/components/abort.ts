import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'AbortFieldsLoadingsRequest' })
export class Request extends SignatureRequirement {
    public fields: string[];

    constructor(input: { fields: string[] }) {
        super();
        validator.isObject(input);
        this.fields = validator.getAsArray(input, 'fields');
    }
}
export interface Request extends Interface {}

@Define({ name: 'AbortFieldsLoadingsResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
