import { Define, Interface, SignatureRequirement } from '../declarations';
import { ShellProfile } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'ShellProfilesListRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'ShellProfilesListResponse' })
export class Response extends SignatureRequirement {
    public shells: ShellProfile[];

    constructor(input: { shells: ShellProfile[] }) {
        super();
        validator.isObject(input);
        this.shells = validator.getAsArray(input, 'shells');
    }
}

export interface Response extends Interface {}
