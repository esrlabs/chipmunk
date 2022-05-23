import { Define, Interface, SignatureRequirement } from '../declarations';
import { Entity } from '../../../types/files';

import * as validator from '../../../env/obj';

@Define({ name: 'AsFSEntityRequest' })
export class Request extends SignatureRequirement {
    public path: string;

    constructor(input: { path: string }) {
        super();
        validator.isObject(input);
        this.path = validator.getAsNotEmptyString(input, 'path');
    }
}
export interface Request extends Interface {}

@Define({ name: 'AsFSEntityResponse' })
export class Response extends SignatureRequirement {
    public entity: Entity | undefined;
    public error: string | undefined;

    constructor(input: { entity?: Entity; error?: string }) {
        super();
        validator.isObject(input);
        this.entity = validator.getAsObjOrUndefined(input, 'entity');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
