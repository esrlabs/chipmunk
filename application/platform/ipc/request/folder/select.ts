import { Define, Interface, SignatureRequirement } from '../declarations';
import { FileType, File } from '../../../types/files';

import * as validator from '../../../env/obj';

@Define({ name: 'SelectFilesInFolderRequest' })
export class Request extends SignatureRequirement {
    public target: FileType;
    public ext?: string;

    constructor(input: { target: FileType; ext?: string }) {
        super();
        validator.isObject(input);
        this.target = input.target;
        this.ext = validator.getAsNotEmptyStringOrAsUndefined(input, 'ext');
    }
}
export interface Request extends Interface {}

@Define({ name: 'SelectFilesInFolderResponse' })
export class Response extends SignatureRequirement {
    public files: File[];

    constructor(input: { files: File[] }) {
        super();
        validator.isObject(input);
        this.files = input.files;
    }
}

export interface Response extends Interface {}
