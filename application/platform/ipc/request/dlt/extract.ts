import { Define, Interface, SignatureRequirement } from '../declarations';
import { FtFile, FtOptions } from '../../../types/parsers/dlt';
import * as validator from '../../../env/obj';

@Define({ name: 'DltExtractRequest' })
export class Request extends SignatureRequirement {
    public file: string;
    public output: string;
    public attachments: FtFile[] | undefined;
    public options: FtOptions | undefined;

    constructor(input: { 
        file: string, 
        output: string, 
        attachments: FtFile[] | undefined, 
        options: FtOptions | undefined
    }) {
        super();
        validator.isObject(input);
        this.file = validator.getAsNotEmptyString(input, 'file');
        this.output = validator.getAsNotEmptyString(input, 'output');
        this.attachments = validator.getAsArrayOrUndefined(input, 'attachments');
        this.options = validator.getAsObjOrUndefined(input, 'options');
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
