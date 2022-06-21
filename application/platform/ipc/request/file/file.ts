import { Define, Interface, SignatureRequirement } from '../declarations';
import { File } from '../../../types/files';

import * as validator from '../../../env/obj';

@Define({ name: 'FileByPathRequest' })
export class Request extends SignatureRequirement {
    public filename: string[];

    constructor(input: { filename: string[] }) {
        super();
        validator.isObject(input);
        this.filename = validator.getAsArray(input, 'filename');
    }
}
export interface Request extends Interface {}

@Define({ name: 'FileByPathResponse' })
export class Response extends SignatureRequirement {
    public files: File[];

    constructor(input: { files: File[] }) {
        super();
        validator.isObject(input);
        this.files = input.files;
    }
}

export interface Response extends Interface {}
