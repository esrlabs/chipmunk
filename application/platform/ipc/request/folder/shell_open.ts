import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'FolderShellOpenRequest' })
export class Request extends SignatureRequirement {
    public path: string;
    constructor(input: { path: string }) {
        super();
        validator.isObject(input);
        this.path = validator.getAsNotEmptyString(input, 'path');
    }
}
export interface Request extends Interface {}

@Define({ name: 'FolderShellOpenResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
