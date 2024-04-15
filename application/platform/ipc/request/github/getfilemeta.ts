import { Define, Interface, SignatureRequirement } from '../declarations';
import { FileMetaDataDefinition } from '../../../types/github/filemetadata';

import * as validator from '../../../env/obj';

@Define({ name: 'GetFileMetaDataFromGitHubRepoRequest' })
export class Request extends SignatureRequirement {
    public checksum: string;
    public sha?: string;

    constructor(input: { checksum: string; sha?: string }) {
        super();
        validator.isObject(input);
        this.checksum = validator.getAsNotEmptyString(input, 'checksum');
        this.sha = validator.getAsNotEmptyStringOrAsUndefined(input, 'sha');
    }
}
export interface Request extends Interface {}

@Define({ name: 'GetFileMetaDataFromGitHubRepoResponse' })
export class Response extends SignatureRequirement {
    public error?: string;
    public exists: boolean;
    public metadata?: FileMetaDataDefinition;
    public sha?: string;

    constructor(input: {
        metadata?: FileMetaDataDefinition;
        exists: boolean;
        error?: string;
        sha?: string;
    }) {
        super();
        validator.isObject(input);
        this.exists = validator.getAsBool(input, 'exists');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
        this.metadata = validator.getAsObjOrUndefined(input, 'metadata');
        this.sha = validator.getAsNotEmptyStringOrAsUndefined(input, 'sha');
    }
}

export interface Response extends Interface {}
