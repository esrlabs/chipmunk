import { Define, Interface, SignatureRequirement } from '../declarations';

import * as validator from '../../../env/obj';

@Define({ name: 'ParseFilenameRequest' })
export class Request extends SignatureRequirement {
    public path: string;

    constructor(input: { path: string }) {
        super();
        validator.isObject(input);
        this.path = validator.getAsNotEmptyString(input, 'path');
    }
}
export interface Request extends Interface {}

@Define({ name: 'ParseFilenameResponse' })
export class Response extends SignatureRequirement {
    public filename: string;
    public name: string;
    public parent: string;
    public ext: string;

    constructor(input: { name: string; filename: string; parent: string; ext: string }) {
        super();
        validator.isObject(input);
        this.filename = validator.getAsString(input, 'filename');
        this.name = validator.getAsString(input, 'name');
        this.parent = validator.getAsString(input, 'parent');
        this.ext = validator.getAsString(input, 'ext');
    }
}

export interface Response extends Interface {}
