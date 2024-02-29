import { Define, Interface, SignatureRequirement } from '../declarations';
import { FileMetaDataDefinition } from '../../../types/github/filemetadata';

import * as validator from '../../../env/obj';

@Define({ name: 'SetFileMetaDataFromGitHubRepoRequest' })
export class Request extends SignatureRequirement {
    public checksum: string;
    public metadata: FileMetaDataDefinition;

    constructor(input: { metadata: FileMetaDataDefinition; checksum: string }) {
        super();
        validator.isObject(input);
        this.checksum = validator.getAsNotEmptyString(input, 'checksum');
        this.metadata = validator.getAsObj(input, 'metadata');
    }
}
export interface Request extends Interface {}

@Define({ name: 'SetFileMetaDataFromGitHubRepoResponse' })
export class Response extends SignatureRequirement {
    public error?: string;

    constructor(input: { error?: string }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
