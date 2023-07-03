import { Define, Interface, SignatureRequirement } from '../declarations';
import { File } from '../../../types/files';
import { FileType } from '../../../types/observe/types/file';

import * as validator from '../../../env/obj';

@Define({ name: 'SelectFileRequest' })
export class Request extends SignatureRequirement {
    public target: FileType | undefined;
    public ext?: string;

    constructor(input: { target: FileType | undefined; ext?: string }) {
        super();
        validator.isObject(input);
        this.target = validator.getAsNotEmptyStringOrAsUndefined(input, 'target') as
            | FileType
            | undefined;
        this.ext = validator.getAsNotEmptyStringOrAsUndefined(input, 'ext');
    }
}
export interface Request extends Interface {}

@Define({ name: 'SelectFileResponse' })
export class Response extends SignatureRequirement {
    public files: File[];

    constructor(input: { files: File[] }) {
        super();
        validator.isObject(input);
        this.files = input.files;
    }
}

export interface Response extends Interface {}
