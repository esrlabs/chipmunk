import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'FileUpdatedOnGitHubRepo' })
export class Event extends SignatureRequirement {
    public checksum: string;
    public sha: string;

    constructor(input: { checksum: string; sha: string }) {
        super();
        validator.isObject(input);
        this.checksum = validator.getAsNotEmptyString(input, 'checksum');
        this.sha = validator.getAsNotEmptyString(input, 'sha');
    }
}

export interface Event extends Interface {}
