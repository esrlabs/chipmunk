import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';
import { InvalidPluginEntity } from '../../../types/bindings/plugins';

@Define({ name: 'InvalidPluginInfoRequest' })
export class Request extends SignatureRequirement {
    public pluginPath: string;

    constructor(input: { pluginPath: string }) {
        super();
        validator.isObject(input);
        this.pluginPath = validator.getAsNotEmptyString(input, 'pluginPath');
    }
}
export interface Request extends Interface {}

@Define({ name: 'InvalidPluginInfoResponse' })
export class Response extends SignatureRequirement {
    public invalidPlugin: InvalidPluginEntity | undefined;

    constructor(input: { invalidPlugin?: InvalidPluginEntity }) {
        super();
        validator.isObject(input);
        this.invalidPlugin = validator.getAsObjOrUndefined(input, 'invalidPlugin');
    }
}

export interface Response extends Interface {}
