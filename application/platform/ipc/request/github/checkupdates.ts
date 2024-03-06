import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'CheckFileMetaDataFromGitHubRepoRequest' })
export class Request extends SignatureRequirement {
    public checksum: string;

    constructor(input: { checksum: string }) {
        super();
        validator.isObject(input);
        this.checksum = validator.getAsNotEmptyString(input, 'checksum');
    }
}
export interface Request extends Interface {}

@Define({ name: 'CheckFileMetaDataFromGitHubRepoResponse' })
export class Response extends SignatureRequirement {
    public error?: string;
    public updated: boolean;
    public exists: boolean;
    constructor(input: { error?: string; updated: boolean; exists: boolean }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
        this.updated = validator.getAsBool(input, 'updated');
        this.exists = validator.getAsBool(input, 'exists');
    }
}

export interface Response extends Interface {}
