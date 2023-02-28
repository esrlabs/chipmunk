import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'OpenUrlInBrowserActionRequest' })
export class Request extends SignatureRequirement {
    public url: string;

    constructor(input: { url: string }) {
        super();
        validator.isObject(input);
        this.url = validator.getAsNotEmptyString(input, 'url');
    }
}
export interface Request extends Interface {}

@Define({ name: 'OpenUrlInBrowserActionResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
