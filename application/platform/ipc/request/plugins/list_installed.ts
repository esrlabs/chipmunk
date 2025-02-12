import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

import { PluginEntity } from '../../../types/bindings/plugins';

@Define({ name: 'ListInstalledPluginsRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'ListInstalledPluginsResponse' })
export class Response extends SignatureRequirement {
    public plugins: PluginEntity[];

    constructor(input: { plugins: PluginEntity[] }) {
        super();
        validator.isObject(input);
        this.plugins = validator.getAsArray(input, 'plugins');
    }
}

export interface Response extends Interface {}
