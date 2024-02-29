import { Define, Interface, SignatureRequirement } from '../declarations';
import { FileMetaDataDefinition } from '../../../types/github/filemetadata';

import * as validator from '../../../env/obj';

@Define({ name: 'GetFileMetaDataFromGitHubRepoRequest' })
export class Request extends SignatureRequirement {
    public checksum: string;

    constructor(input: { checksum: string }) {
        super();
        validator.isObject(input);
        this.checksum = validator.getAsNotEmptyString(input, 'checksum');
    }
}
export interface Request extends Interface {}

@Define({ name: 'GetFileMetaDataFromGitHubRepoResponse' })
export class Response extends SignatureRequirement {
    public error?: string;
    public exists: boolean;
    public metadata?: FileMetaDataDefinition;

    constructor(input: { metadata?: FileMetaDataDefinition; exists: boolean; error?: string }) {
        super();
        validator.isObject(input);
        this.exists = validator.getAsBool(input, 'exists');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
        this.metadata = validator.getAsObjOrUndefined(input, 'metadata');
    }
}

export interface Response extends Interface {}
