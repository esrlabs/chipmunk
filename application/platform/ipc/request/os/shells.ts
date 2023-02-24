import { Define, Interface, SignatureRequirement } from '../declarations';
import { ShellProfile } from '../../../types/shells';

import * as validator from '../../../env/obj';

@Define({ name: 'ShellProfilesListRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'ShellProfilesListResponse' })
export class Response extends SignatureRequirement {
    public profiles: ShellProfile[];

    constructor(input: { profiles: ShellProfile[] }) {
        super();
        validator.isObject(input);
        this.profiles = validator.getAsArray(input, 'profiles');
    }
}

export interface Response extends Interface {}
