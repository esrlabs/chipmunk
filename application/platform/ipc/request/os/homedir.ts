import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'OSHomeDirRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'OSHomeDirResponse' })
export class Response extends SignatureRequirement {
    public path: string;

    constructor(input: { path: string }) {
        super();
        validator.isObject(input);
        this.path = validator.getAsString(input, 'path');
    }
}

export interface Response extends Interface {}
