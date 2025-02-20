import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

import { PluginRunData } from '../../../types/bindings/plugins';

@Define({ name: 'PluginRunDataRequest' })
export class Request extends SignatureRequirement {
    public pluginPath: string;

    constructor(input: { pluginPath: string }) {
        super();
        validator.isObject(input);
        this.pluginPath = validator.getAsNotEmptyString(input, 'pluginPath');
    }
}
export interface Request extends Interface {}

@Define({ name: 'PluginRunDataResponse' })
export class Response extends SignatureRequirement {
    public data: PluginRunData | undefined;

    constructor(input: { data?: PluginRunData }) {
        super();
        validator.isObject(input);
        this.data = validator.getAsObjOrUndefined(input, 'data');
    }
}

export interface Response extends Interface {}
