import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'ListFoldersFromRequest' })
export class Request extends SignatureRequirement {
    public path: string;

    constructor(input: { path: string }) {
        super();
        validator.isObject(input);
        this.path = validator.getAsNotEmptyString(input, 'path');
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
