import { Define, Interface, SignatureRequirement } from '../declarations';
import { Attachment } from '../../../types/parsers/dlt';
import * as validator from '../../../env/obj';

@Define({ name: 'DltExtractRequest' })
export class Request extends SignatureRequirement {
    public file: string;
    public output: string;
    public attachments: [Attachment, string][];

    constructor(input: { 
        file: string, 
        output: string, 
        attachments: [Attachment, string][], 
    }) {
        super();
        validator.isObject(input);
        this.file = validator.getAsNotEmptyString(input, 'file');
        this.output = validator.getAsNotEmptyString(input, 'output');
        this.attachments = validator.getAsArray(input, 'attachments');
    }
}
export interface Request extends Interface {}

@Define({ name: 'DltExtractResponse' })
export class Response extends SignatureRequirement {
    public size: number;

    constructor(input: { size: number }) {
        super();
        validator.isObject(input);
        this.size = validator.getAsValidNumber(input, 'size');
    }
}

export interface Response extends Interface {}
