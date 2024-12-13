import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'ListActivePluginsRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'ListActivePluginsResponse' })
export class Response extends SignatureRequirement {
    public pluginsJson: string;
    public error?: string;

    constructor(input: { pluginsJson?: string; error?: string }) {
        super();
        validator.isObject(input);
        this.pluginsJson = validator.getAsNotEmptyStringOrAsUndefined(input, 'pluginsJson');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
