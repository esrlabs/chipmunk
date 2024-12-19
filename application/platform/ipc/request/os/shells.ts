import { Define, Interface, SignatureRequirement } from '../declarations';
import { Profile } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'ShellProfilesListRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'ShellProfilesListResponse' })
export class Response extends SignatureRequirement {
    public profiles: Profile[];

    constructor(input: { profiles: Profile[] }) {
        super();
        validator.isObject(input);
        this.profiles = validator.getAsArray(input, 'profiles');
    }
}

export interface Response extends Interface {}
