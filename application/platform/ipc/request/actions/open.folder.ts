import { Define, Interface, SignatureRequirement } from '../declarations';
import { FileType } from '../../../types/observe/types/file';

import * as validator from '../../../env/obj';

@Define({ name: 'OpenFolderActionRequest' })
export class Request extends SignatureRequirement {
    public type: FileType | undefined;

    constructor(input: { type: FileType | undefined }) {
        super();
        validator.isObject(input);
        this.type = validator.getAsNotEmptyStringOrAsUndefined(input, 'type') as
            | FileType
            | undefined;
    }
}
export interface Request extends Interface {}

@Define({ name: 'OpenFolderActionResponse' })
export class Response extends SignatureRequirement {
    public error: string | undefined;

    constructor(input: { error: string | undefined }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
