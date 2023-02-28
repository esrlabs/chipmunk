import { Define, Interface, SignatureRequirement } from '../declarations';
import { Attachment, FtOptions } from '../../../types/parsers/dlt';
import * as validator from '../../../env/obj';

@Define({ name: 'DltScanRequest' })
export class Request extends SignatureRequirement {
    public file: string;
    public options: FtOptions;

    constructor(input: { file: string, options: FtOptions }) {
        super();
        validator.isObject(input);
        this.file = validator.getAsNotEmptyString(input, 'file');
        this.options = validator.getAsObj(input, 'options');
    }
}
export interface Request extends Interface {}

@Define({ name: 'DltScanResponse' })
export class Response extends SignatureRequirement {
    public attachments: Attachment[];

    constructor(input: { attachments: Attachment[] }) {
        super();
        validator.isObject(input);
        this.attachments = validator.getAsArray(input, 'attachments');
    }
}

export interface Response extends Interface {}
