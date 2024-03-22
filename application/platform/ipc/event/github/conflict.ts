import { Define, Interface, SignatureRequirement } from '../declarations';
import { FileMetaDataDefinition, validate } from '../../../types/github/filemetadata';
import * as validator from '../../../env/obj';

@Define({ name: 'ConflictOnGitHubRepo' })
export class Event extends SignatureRequirement {
    public checksum: string;
    public sha: string;
    public username: string;
    public md: FileMetaDataDefinition;

    constructor(input: {
        checksum: string;
        sha: string;
        username: string;
        md: FileMetaDataDefinition;
    }) {
        super();
        validator.isObject(input);
        this.checksum = validator.getAsNotEmptyString(input, 'checksum');
        this.sha = validator.getAsNotEmptyString(input, 'sha');
        this.username = validator.getAsNotEmptyString(input, 'username');
        this.md = validate(input.md);
    }
}

export interface Event extends Interface {}
