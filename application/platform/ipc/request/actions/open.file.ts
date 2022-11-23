import { Define, Interface, SignatureRequirement } from '../declarations';
import { FileType } from '../../../types/files';

import * as validator from '../../../env/obj';

@Define({ name: 'OpenFileActionRequest' })
export class Request extends SignatureRequirement {
    public type: FileType;

    constructor(input: { type: FileType }) {
        super();
        validator.isObject(input);
        this.type = validator.getAsNotEmptyString(input, 'type') as FileType;
    }
}
export interface Request extends Interface {}

@Define({ name: 'OpenFileActionResponse' })
export class Response extends SignatureRequirement {
    public error: string | undefined;

    constructor(input: { error: string | undefined }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
