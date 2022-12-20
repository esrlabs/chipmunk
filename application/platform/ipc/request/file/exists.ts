import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'DoesExistRequest' })
export class Request extends SignatureRequirement {
    public path: string;

    constructor(input: { path: string }) {
        super();
        validator.isObject(input);
        this.path = validator.getAsNotEmptyString(input, 'path');
    }
}
export interface Request extends Interface {}

@Define({ name: 'DoesExistResponse' })
export class Response extends SignatureRequirement {
    public exists: boolean;

    constructor(input: { exists: boolean }) {
        super();
        validator.isObject(input);
        this.exists = validator.getAsBool(input, 'exists');
    }
}

export interface Response extends Interface {}
