import { Define, Interface, SignatureRequirement } from '../declarations';
import { FileMetaDataDefinition } from '../../../types/github/filemetadata';

import * as validator from '../../../env/obj';

@Define({ name: 'SetFileMetaDataFromGitHubRepoRequest' })
export class Request extends SignatureRequirement {
    public checksum: string;
    public metadata: FileMetaDataDefinition;
    public sha: string | undefined;

    constructor(input: {
        metadata: FileMetaDataDefinition;
        checksum: string;
        sha: string | undefined;
    }) {
        super();
        validator.isObject(input);
        this.checksum = validator.getAsNotEmptyString(input, 'checksum');
        this.sha = validator.getAsNotEmptyStringOrAsUndefined(input, 'sha');
        this.metadata = validator.getAsObj(input, 'metadata');
    }
}
export interface Request extends Interface {}

@Define({ name: 'SetFileMetaDataFromGitHubRepoResponse' })
export class Response extends SignatureRequirement {
    public error?: string;
    public sha: string | undefined;

    constructor(input: { error?: string; sha: string | undefined }) {
        super();
        validator.isObject(input);
        this.sha = validator.getAsNotEmptyStringOrAsUndefined(input, 'sha');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
