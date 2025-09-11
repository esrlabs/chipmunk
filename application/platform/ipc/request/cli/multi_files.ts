import { Define, Interface, SignatureRequirement } from '../declarations';
import { File } from '../../../types/files';

import * as validator from '../../../env/obj';

@Define({ name: 'MultiFilesCLICommandRequest' })
export class Request extends SignatureRequirement {
    public files: File[];

    constructor(input: { files: File[] }) {
        super();
        validator.isObject(input);
        this.files = validator.getAsObj(input, 'files');
    }
}

export interface Request extends Interface {}

@Define({ name: 'MultiFilesCLICommandResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
