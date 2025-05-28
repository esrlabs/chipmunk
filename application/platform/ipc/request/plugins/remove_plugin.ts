import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'RemovePluginRequest' })
export class Request extends SignatureRequirement {
    public pluginPath: string;

    constructor(input: { pluginPath: string }) {
        super();
        validator.isObject(input);
        this.pluginPath = validator.getAsNotEmptyString(input, 'pluginPath');
    }
}
export interface Request extends Interface {}

@Define({ name: 'RemovePluginResponse' })
export class Response extends SignatureRequirement {
    public error?: string;

    constructor(input: { error?: string }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
