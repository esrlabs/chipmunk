import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';
import { PluginEntity } from '../../../types/bindings/plugins';

@Define({ name: 'InstalledPluginInfoRequest' })
export class Request extends SignatureRequirement {
    public pluginPath: string;

    constructor(input: { pluginPath: string }) {
        super();
        validator.isObject(input);
        this.pluginPath = validator.getAsNotEmptyString(input, 'pluginPath');
    }
}
export interface Request extends Interface {}

@Define({ name: 'InstalledPluginInfoResponse' })
export class Response extends SignatureRequirement {
    public plugin: PluginEntity | undefined;

    constructor(input: { plugin?: PluginEntity }) {
        super();
        validator.isObject(input);
        this.plugin = validator.getAsObjOrUndefined(input, 'plugin');
    }
}

export interface Response extends Interface {}
