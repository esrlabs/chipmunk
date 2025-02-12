import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

import { InvalidPluginEntity } from '../../../types/bindings/plugins';

@Define({ name: 'ListInvalidPluginsRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'ListInvalidPluginsResponse' })
export class Response extends SignatureRequirement {
    public invalidPlugins: InvalidPluginEntity[];

    constructor(input: { invalidPlugins: InvalidPluginEntity[] }) {
        super();
        validator.isObject(input);
        this.invalidPlugins = validator.getAsArray(input, 'invalidPlugins');
    }
}

export interface Response extends Interface {}
