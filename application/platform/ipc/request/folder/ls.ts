import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'ListFoldersFromRequest' })
export class Request extends SignatureRequirement {
    public paths: string[];

    constructor(input: { paths: string[] }) {
        super();
        validator.isObject(input);
        this.paths = validator.getAsArrayOfNotEmptyString(input, 'paths');
    }
}
export interface Request extends Interface {}

@Define({ name: 'ListFoldersFromResponse' })
export class Response extends SignatureRequirement {
    public folders: string[];

    constructor(input: { folders: string[] }) {
        super();
        validator.isObject(input);
        this.folders = validator.getAsArray(input, 'folders');
    }
}

export interface Response extends Interface {}
