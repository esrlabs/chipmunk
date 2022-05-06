import { Define, Interface, SignatureRequirement } from '../declarations';
import { TargetFile } from '../../../types/files';

import * as validator from '../../../env/obj';

@Define({ name: 'SessionCreateRequest' })
export class Request extends SignatureRequirement {
    public file?: TargetFile;

    constructor(input: { file?: TargetFile }) {
        super();
        validator.isObject(input);
        this.file = validator.getAsObjOrUndefined(input, 'file');
    }
}
export interface Request extends Interface {}

@Define({ name: 'SessionCreateResponse' })
export class Response extends SignatureRequirement {
    public uuid: string;

    constructor(input: { uuid: string }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyString(input, 'uuid');
    }
}

export interface Response extends Interface {}
